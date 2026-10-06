-- =====================================================================
-- Mudanzas: los cajones que se entregaron en una dirección viajan con la mudanza a otra.
--   * registrar_mudanza() pasa el saldo del origen al destino en un solo paso y deja un
--     movimiento en cada dirección (mudanza_salida / mudanza_llegada), unidos por mudanza_id.
--   * El aviso de "atrasada" del destino cuenta desde el día de la mudanza.
--   * Al entregar se puede anotar a dónde se muda el cliente (destino_previsto), si ya se sabe.
--   * Anular cualquiera de los dos movimientos deshace la mudanza completa.
-- =====================================================================

alter table direcciones add column destino_previsto text;
alter table movimientos add column mudanza_id uuid;
create index movimientos_mudanza on movimientos (mudanza_id) where mudanza_id is not null;

-- El destino previsto se edita igual que los datos de contacto
grant update (destino_previsto) on direcciones to authenticated;

-- ---------------------------------------------------------------------
-- Vistas: se recrean para incluir las columnas nuevas
-- ---------------------------------------------------------------------
drop view vista_movimientos;
drop view vista_direcciones;

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
  exists (select 1 from movimientos a where a.anula_id = m.id) as anulado,
  cm.direccion_id as contraparte_direccion_id, -- en una mudanza: la otra dirección
  cd.calle        as contraparte_calle,
  o.tipo          as anula_tipo                -- en un ajuste: qué tipo de movimiento anuló
from movimientos m
join direcciones d on d.id = m.direccion_id
join perfiles p on p.id = m.usuario_id
left join movimientos cm on m.mudanza_id is not null and cm.mudanza_id = m.mudanza_id and cm.id <> m.id
left join direcciones cd on cd.id = cm.direccion_id
left join movimientos o on o.id = m.anula_id;

grant select on vista_direcciones, vista_movimientos to authenticated;

-- ---------------------------------------------------------------------
-- RPC: registrar entrega / retiro (ahora acepta el destino previsto en la entrega)
-- ---------------------------------------------------------------------
drop function registrar_movimiento(uuid, tipo_movimiento, integer, integer, uuid, text, text, text, timestamptz, origen_movimiento, text);

create function registrar_movimiento(
  p_client_id        uuid,
  p_tipo             tipo_movimiento,
  p_cajas            integer,
  p_cajones          integer,
  p_direccion_id     uuid default null,
  p_calle            text default null,
  p_referencia       text default null,
  p_nota             text default null,
  p_registrado_en    timestamptz default now(),
  p_origen           origen_movimiento default 'app',
  p_transcripcion    text default null,
  p_destino_previsto text default null
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

  if p_tipo::text not in ('entrega', 'retiro') then
    raise exception 'Los ajustes se hacen anulando un movimiento y las mudanzas con "Registrar mudanza".' using errcode = 'P0001';
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
        raise exception 'No hay cajas ni cajones registrados en %. Si vinieron de otra dirección, registrá primero la mudanza.',
          trim(p_calle) using errcode = 'P0001';
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
    ultima_entrega_en = case when p_tipo = 'entrega' then now() else ultima_entrega_en end,
    destino_previsto  = case when p_tipo = 'entrega' and nullif(trim(p_destino_previsto), '') is not null
                             then regexp_replace(trim(p_destino_previsto), '\s+', ' ', 'g')
                             else destino_previsto end
  where id = v_dir.id
  returning * into v_dir;

  update direcciones set
    estado = case when saldo_cajas + saldo_cajones = 0 then 'completada' else 'pendiente' end::estado_direccion
  where id = v_dir.id;

  return v_mov;
end $$;

-- ---------------------------------------------------------------------
-- RPC: registrar una mudanza (origen → destino). Es idempotente por p_client_id.
-- El destino puede ser una dirección existente (p_destino_id) o un texto (p_destino_calle).
-- ---------------------------------------------------------------------
create function registrar_mudanza(
  p_client_id           uuid,
  p_origen_id           uuid,
  p_cajas               integer,
  p_cajones             integer,
  p_destino_id          uuid default null,
  p_destino_calle       text default null,
  p_destino_referencia  text default null,
  p_nota                text default null,
  p_registrado_en       timestamptz default now()
) returns movimientos
language plpgsql security definer set search_path = public as $$
declare
  v_salida  movimientos;
  v_origen  direcciones;
  v_destino direcciones;
  v_grupo   uuid := gen_random_uuid();
  v_fecha   timestamptz := coalesce(p_registrado_en, now());
begin
  if not es_activo() then
    raise exception 'Tu usuario no está activo. Hablá con un administrador.' using errcode = 'P0001';
  end if;

  select * into v_salida from movimientos where client_id = p_client_id;
  if found then return v_salida; end if;

  if coalesce(p_cajas, 0) < 0 or coalesce(p_cajones, 0) < 0 or coalesce(p_cajas, 0) + coalesce(p_cajones, 0) = 0 then
    raise exception 'Ingresá al menos una caja o un cajón.' using errcode = 'P0001';
  end if;

  select * into v_origen from direcciones where id = p_origen_id for update;
  if not found then
    raise exception 'La dirección de origen no existe.' using errcode = 'P0001';
  end if;
  if p_cajas > v_origen.saldo_cajas or p_cajones > v_origen.saldo_cajones then
    raise exception 'En % hay % y %: no se puede mudar más de eso.', v_origen.calle,
      v_origen.saldo_cajas || case when v_origen.saldo_cajas = 1 then ' caja' else ' cajas' end,
      v_origen.saldo_cajones || case when v_origen.saldo_cajones = 1 then ' cajón' else ' cajones' end
      using errcode = 'P0001';
  end if;

  -- Resolver destino (si no existe, se crea)
  if p_destino_id is not null then
    select * into v_destino from direcciones where id = p_destino_id for update;
    if not found then
      raise exception 'La dirección de destino no existe.' using errcode = 'P0001';
    end if;
  else
    if p_destino_calle is null or length(trim(p_destino_calle)) = 0 then
      raise exception 'Indicá a qué dirección se mudan.' using errcode = 'P0001';
    end if;
    select * into v_destino from direcciones
      where calle_normalizada = lower(regexp_replace(trim(p_destino_calle), '\s+', ' ', 'g'))
      for update;
    if not found then
      insert into direcciones (calle, referencia, creada_por)
        values (regexp_replace(trim(p_destino_calle), '\s+', ' ', 'g'), nullif(trim(p_destino_referencia), ''), auth.uid())
        returning * into v_destino;
    end if;
  end if;

  if v_destino.id = v_origen.id then
    raise exception 'La dirección de destino tiene que ser distinta de la de origen.' using errcode = 'P0001';
  end if;

  insert into movimientos (client_id, direccion_id, usuario_id, tipo, cajas, cajones, nota, registrado_en, mudanza_id)
  values (p_client_id, v_origen.id, auth.uid(), 'mudanza_salida', p_cajas, p_cajones, nullif(trim(p_nota), ''), v_fecha, v_grupo)
  returning * into v_salida;

  insert into movimientos (client_id, direccion_id, usuario_id, tipo, cajas, cajones, nota, registrado_en, mudanza_id)
  values (gen_random_uuid(), v_destino.id, auth.uid(), 'mudanza_llegada', p_cajas, p_cajones, nullif(trim(p_nota), ''), v_fecha, v_grupo);

  -- Origen: se va lo mudado y el destino previsto ya se cumplió
  update direcciones set
    saldo_cajas      = saldo_cajas   - p_cajas,
    saldo_cajones    = saldo_cajones - p_cajones,
    destino_previsto = null,
    estado = case when saldo_cajas - p_cajas + saldo_cajones - p_cajones = 0 then 'completada' else 'pendiente' end::estado_direccion
  where id = v_origen.id;

  -- Destino: llegan los cajones; el plazo para retirar cuenta desde hoy.
  -- Es el mismo cliente: si el destino no tiene contacto, se copia el del origen.
  update direcciones set
    saldo_cajas       = saldo_cajas   + p_cajas,
    saldo_cajones     = saldo_cajones + p_cajones,
    ultima_entrega_en = now(),
    estado            = 'pendiente',
    contacto_nombre   = case when contacto_nombre is null and contacto_telefono is null then v_origen.contacto_nombre else contacto_nombre end,
    contacto_telefono = case when contacto_nombre is null and contacto_telefono is null then v_origen.contacto_telefono else contacto_telefono end
  where id = v_destino.id;

  return v_salida;
end $$;

-- ---------------------------------------------------------------------
-- RPC: anular (ahora también deshace una mudanza completa: origen y destino)
-- ---------------------------------------------------------------------
create or replace function anular_movimiento(p_movimiento_id uuid, p_motivo text)
returns movimientos
language plpgsql security definer set search_path = public as $$
declare
  v_orig  movimientos;
  v_par   movimientos;
  v_dir   direcciones;
  v_mov   movimientos;
  v_signo integer;
  v_m     movimientos;
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

  -- En una mudanza se anulan los dos movimientos (salida y llegada)
  if v_orig.mudanza_id is not null then
    select * into v_par from movimientos where mudanza_id = v_orig.mudanza_id and id <> v_orig.id;
  end if;

  for v_m in select * from movimientos where id = v_orig.id or (v_par.id is not null and id = v_par.id) order by id loop
    select * into v_dir from direcciones where id = v_m.direccion_id for update;
    v_signo := case when v_m.tipo::text in ('entrega', 'mudanza_llegada') then -1 else 1 end;

    if v_dir.saldo_cajas + v_signo * v_m.cajas < 0 or v_dir.saldo_cajones + v_signo * v_m.cajones < 0 then
      raise exception 'No se puede anular: el saldo de % quedaría negativo. Revisá los retiros posteriores.', v_dir.calle
        using errcode = 'P0001';
    end if;

    insert into movimientos (client_id, direccion_id, usuario_id, tipo, cajas, cajones, nota, anula_id)
    values (gen_random_uuid(), v_dir.id, auth.uid(), 'ajuste',
            v_signo * v_m.cajas, v_signo * v_m.cajones, trim(p_motivo), v_m.id)
    returning * into v_mov;

    update direcciones set
      saldo_cajas   = saldo_cajas   + v_signo * v_m.cajas,
      saldo_cajones = saldo_cajones + v_signo * v_m.cajones
    where id = v_dir.id;

    update direcciones set
      estado = case when saldo_cajas + saldo_cajones = 0 then 'completada' else 'pendiente' end::estado_direccion
    where id = v_dir.id;
  end loop;

  return v_mov;
end $$;

revoke execute on function registrar_movimiento, registrar_mudanza, anular_movimiento from public, anon;
grant execute on function registrar_movimiento, registrar_mudanza, anular_movimiento to authenticated;
