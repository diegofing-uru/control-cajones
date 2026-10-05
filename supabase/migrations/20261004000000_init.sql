-- =====================================================================
-- Control de cajas y cajones — esquema inicial (MVP)
-- Reglas clave:
--   * El saldo de cada dirección solo cambia a través de funciones (RPC).
--   * Los movimientos nunca se borran: una corrección es un "ajuste".
--   * Cada movimiento guarda quién lo hizo, cuándo y desde dónde (app / whatsapp).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

create type rol_usuario       as enum ('operario', 'administrador');
create type tipo_movimiento   as enum ('entrega', 'retiro', 'ajuste');
create type origen_movimiento as enum ('app', 'whatsapp');
create type estado_direccion  as enum ('pendiente', 'completada');

-- ---------------------------------------------------------------------
-- Perfiles de usuario (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null,
  telefono   text unique,               -- se usará para identificar audios de WhatsApp (fase 2)
  rol        rol_usuario not null default 'operario',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- Crea el perfil automáticamente al dar de alta un usuario en Auth
create function crear_perfil_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, telefono, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'telefono', ''),
    coalesce((new.raw_user_meta_data ->> 'rol')::rol_usuario, 'operario')
  );
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_nuevo_usuario();

create function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'administrador' and activo
  );
$$;

create function es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

-- ---------------------------------------------------------------------
-- Configuración (fila única)
-- ---------------------------------------------------------------------
create table configuracion (
  id          boolean primary key default true check (id),
  dias_alerta integer not null default 15 check (dias_alerta between 1 and 365)
);
insert into configuracion default values;

-- ---------------------------------------------------------------------
-- Direcciones
-- ---------------------------------------------------------------------
create table direcciones (
  id                uuid primary key default gen_random_uuid(),
  calle             text not null check (length(trim(calle)) > 0),
  calle_normalizada text generated always as (lower(regexp_replace(trim(calle), '\s+', ' ', 'g'))) stored,
  referencia        text,
  contacto_nombre   text,
  contacto_telefono text,
  saldo_cajas       integer not null default 0 check (saldo_cajas >= 0),
  saldo_cajones     integer not null default 0 check (saldo_cajones >= 0),
  estado            estado_direccion not null default 'completada',
  ultima_entrega_en timestamptz,
  creada_por        uuid references perfiles (id),
  creada_en         timestamptz not null default now()
);

create unique index direcciones_calle_unica on direcciones (calle_normalizada);
create index direcciones_calle_trgm on direcciones using gin (calle_normalizada extensions.gin_trgm_ops);
create index direcciones_estado on direcciones (estado, ultima_entrega_en);

-- ---------------------------------------------------------------------
-- Movimientos (registro de auditoría, solo inserción)
-- ---------------------------------------------------------------------
create table movimientos (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null unique,      -- generado en el celular: evita duplicados al sincronizar offline
  direccion_id  uuid not null references direcciones (id),
  usuario_id    uuid not null references perfiles (id),
  tipo          tipo_movimiento not null,
  cajas         integer not null default 0,
  cajones       integer not null default 0,
  origen        origen_movimiento not null default 'app',
  nota          text,
  transcripcion text,                      -- texto original del audio (fase 2)
  anula_id      uuid unique references movimientos (id),
  registrado_en timestamptz not null default now(), -- hora en el celular (puede diferir si fue offline)
  creado_en     timestamptz not null default now(),
  constraint cantidades_validas check (
    (tipo <> 'ajuste' and cajas >= 0 and cajones >= 0 and cajas + cajones > 0)
    or (tipo = 'ajuste' and (cajas <> 0 or cajones <> 0))
  )
);

create index movimientos_direccion on movimientos (direccion_id, creado_en desc);
create index movimientos_fecha on movimientos (creado_en desc);

-- ---------------------------------------------------------------------
-- Vistas (heredan RLS de las tablas)
-- ---------------------------------------------------------------------
create view vista_direcciones with (security_invoker = true) as
select
  d.*,
  case when d.estado = 'pendiente' and d.ultima_entrega_en is not null
       then floor(extract(epoch from now() - d.ultima_entrega_en) / 86400)::int end as dias_pendiente,
  (d.estado = 'pendiente'
   and d.ultima_entrega_en is not null
   and now() - d.ultima_entrega_en >= make_interval(days => c.dias_alerta)) as atrasada
from direcciones d
cross join configuracion c;

create view vista_movimientos with (security_invoker = true) as
select
  m.*,
  d.calle,
  p.nombre as usuario_nombre,
  exists (select 1 from movimientos a where a.anula_id = m.id) as anulado
from movimientos m
join direcciones d on d.id = m.direccion_id
join perfiles p on p.id = m.usuario_id;

-- ---------------------------------------------------------------------
-- RPC: registrar un movimiento (entrega / retiro)
-- Acepta una dirección existente (p_direccion_id) o un texto (p_calle):
-- si la calle ya existe se reutiliza, si no se crea. Es idempotente por p_client_id.
-- ---------------------------------------------------------------------
create function registrar_movimiento(
  p_client_id     uuid,
  p_tipo          tipo_movimiento,
  p_cajas         integer,
  p_cajones       integer,
  p_direccion_id  uuid default null,
  p_calle         text default null,
  p_referencia    text default null,
  p_nota          text default null,
  p_registrado_en timestamptz default now(),
  p_origen        origen_movimiento default 'app',
  p_transcripcion text default null
) returns movimientos
language plpgsql security definer set search_path = public as $$
declare
  v_mov movimientos;
  v_dir direcciones;
begin
  if not es_activo() then
    raise exception 'Tu usuario no está activo. Hablá con un administrador.' using errcode = 'P0001';
  end if;

  -- Idempotencia: si este movimiento ya se sincronizó, devolverlo sin repetirlo
  select * into v_mov from movimientos where client_id = p_client_id;
  if found then return v_mov; end if;

  if p_tipo = 'ajuste' then
    raise exception 'Los ajustes se hacen anulando un movimiento.' using errcode = 'P0001';
  end if;
  if coalesce(p_cajas, 0) < 0 or coalesce(p_cajones, 0) < 0 or coalesce(p_cajas, 0) + coalesce(p_cajones, 0) = 0 then
    raise exception 'Ingresá al menos una caja o un cajón.' using errcode = 'P0001';
  end if;

  -- Resolver dirección
  if p_direccion_id is not null then
    select * into v_dir from direcciones where id = p_direccion_id for update;
    if not found then
      raise exception 'La dirección no existe.' using errcode = 'P0001';
    end if;
  else
    if p_calle is null or length(trim(p_calle)) = 0 then
      raise exception 'Indicá una dirección.' using errcode = 'P0001';
    end if;
    select * into v_dir from direcciones
      where calle_normalizada = lower(regexp_replace(trim(p_calle), '\s+', ' ', 'g'))
      for update;
    if not found then
      if p_tipo = 'retiro' then
        raise exception 'No hay cajas ni cajones registrados en %.', trim(p_calle) using errcode = 'P0001';
      end if;
      insert into direcciones (calle, referencia, creada_por)
        values (regexp_replace(trim(p_calle), '\s+', ' ', 'g'), nullif(trim(p_referencia), ''), auth.uid())
        returning * into v_dir;
    end if;
  end if;

  -- Validar saldo en retiros
  if p_tipo = 'retiro' then
    if p_cajas > v_dir.saldo_cajas then
      raise exception 'Solo hay % % registrada% en esta dirección.',
        v_dir.saldo_cajas, case when v_dir.saldo_cajas = 1 then 'caja' else 'cajas' end,
        case when v_dir.saldo_cajas = 1 then '' else 's' end using errcode = 'P0001';
    end if;
    if p_cajones > v_dir.saldo_cajones then
      raise exception 'Solo hay % % registrado% en esta dirección.',
        v_dir.saldo_cajones, case when v_dir.saldo_cajones = 1 then 'cajón' else 'cajones' end,
        case when v_dir.saldo_cajones = 1 then '' else 's' end using errcode = 'P0001';
    end if;
  end if;

  insert into movimientos (client_id, direccion_id, usuario_id, tipo, cajas, cajones, origen, nota, transcripcion, registrado_en)
  values (p_client_id, v_dir.id, auth.uid(), p_tipo, p_cajas, p_cajones, p_origen,
          nullif(trim(p_nota), ''), p_transcripcion, coalesce(p_registrado_en, now()))
  returning * into v_mov;

  update direcciones set
    saldo_cajas       = saldo_cajas   + case when p_tipo = 'entrega' then p_cajas   else -p_cajas   end,
    saldo_cajones     = saldo_cajones + case when p_tipo = 'entrega' then p_cajones else -p_cajones end,
    ultima_entrega_en = case when p_tipo = 'entrega' then now() else ultima_entrega_en end
  where id = v_dir.id
  returning * into v_dir;

  update direcciones set
    estado = case when saldo_cajas + saldo_cajones = 0 then 'completada' else 'pendiente' end::estado_direccion
  where id = v_dir.id;

  return v_mov;
end $$;

-- ---------------------------------------------------------------------
-- RPC: anular un movimiento (solo administradores)
-- Crea un ajuste inverso; el movimiento original queda en el historial.
-- ---------------------------------------------------------------------
create function anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos
language plpgsql security definer set search_path = public as $$
declare
  v_orig movimientos;
  v_dir  direcciones;
  v_mov  movimientos;
  v_signo integer;
begin
  if not es_admin() then
    raise exception 'Solo un administrador puede anular movimientos.' using errcode = 'P0001';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Indicá el motivo de la anulación.' using errcode = 'P0001';
  end if;

  select * into v_orig from movimientos where id = p_movimiento_id;
  if not found then raise exception 'El movimiento no existe.' using errcode = 'P0001'; end if;
  if v_orig.tipo = 'ajuste' then raise exception 'Un ajuste no se puede anular.' using errcode = 'P0001'; end if;
  if exists (select 1 from movimientos where anula_id = v_orig.id) then
    raise exception 'Este movimiento ya fue anulado.' using errcode = 'P0001';
  end if;

  select * into v_dir from direcciones where id = v_orig.direccion_id for update;
  v_signo := case when v_orig.tipo = 'entrega' then -1 else 1 end;

  if v_dir.saldo_cajas + v_signo * v_orig.cajas < 0 or v_dir.saldo_cajones + v_signo * v_orig.cajones < 0 then
    raise exception 'No se puede anular: el saldo actual quedaría negativo. Revisá los retiros posteriores.' using errcode = 'P0001';
  end if;

  insert into movimientos (client_id, direccion_id, usuario_id, tipo, cajas, cajones, nota, anula_id)
  values (gen_random_uuid(), v_dir.id, auth.uid(), 'ajuste',
          v_signo * v_orig.cajas, v_signo * v_orig.cajones, trim(p_motivo), v_orig.id)
  returning * into v_mov;

  update direcciones set
    saldo_cajas   = saldo_cajas   + v_signo * v_orig.cajas,
    saldo_cajones = saldo_cajones + v_signo * v_orig.cajones
  where id = v_dir.id;

  update direcciones set
    estado = case when saldo_cajas + saldo_cajones = 0 then 'completada' else 'pendiente' end::estado_direccion
  where id = v_dir.id;

  return v_mov;
end $$;

-- ---------------------------------------------------------------------
-- RPC: resumen para el panel
-- ---------------------------------------------------------------------
create function resumen_panel()
returns table (cajas_afuera bigint, cajones_afuera bigint, direcciones_pendientes bigint, direcciones_atrasadas bigint, dias_alerta integer)
language sql stable security invoker set search_path = public as $$
  select
    coalesce(sum(saldo_cajas), 0),
    coalesce(sum(saldo_cajones), 0),
    count(*) filter (where estado = 'pendiente'),
    count(*) filter (where atrasada),
    (select dias_alerta from configuracion)
  from vista_direcciones;
$$;

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------
alter table perfiles      enable row level security;
alter table configuracion enable row level security;
alter table direcciones   enable row level security;
alter table movimientos   enable row level security;

-- Perfiles: todos los activos ven a todos; solo admins modifican
create policy perfiles_select on perfiles for select to authenticated using (es_activo() or id = auth.uid());
create policy perfiles_update on perfiles for update to authenticated using (es_admin()) with check (es_admin());

-- Configuración
create policy config_select on configuracion for select to authenticated using (true);
create policy config_update on configuracion for update to authenticated using (es_admin()) with check (es_admin());

-- Direcciones: lectura para activos; solo se editan datos de contacto (el saldo lo maneja la RPC)
create policy direcciones_select on direcciones for select to authenticated using (es_activo());
create policy direcciones_update on direcciones for update to authenticated using (es_activo()) with check (es_activo());
revoke insert, update, delete on direcciones from authenticated, anon;
grant update (referencia, contacto_nombre, contacto_telefono) on direcciones to authenticated;

-- Movimientos: solo lectura directa; se crean por RPC y nunca se borran
create policy movimientos_select on movimientos for select to authenticated using (es_activo());
revoke insert, update, delete on movimientos from authenticated, anon;

grant select on vista_direcciones, vista_movimientos to authenticated;
revoke execute on function registrar_movimiento, anular_movimiento, resumen_panel from public, anon;
grant execute on function registrar_movimiento, anular_movimiento, resumen_panel to authenticated;

-- Tiempo real: la app refresca listas cuando cambia algo
alter publication supabase_realtime add table direcciones, movimientos;
