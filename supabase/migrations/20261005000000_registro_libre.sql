-- =====================================================================
-- Registro libre con aprobación del administrador
--   * Cualquiera puede crear su cuenta (email o celular + contraseña).
--   * La primera cuenta del sistema queda como administrador activo.
--   * Las demás quedan como operario "pendiente" hasta que un admin las apruebe.
--   * El rol nunca se toma de los datos que manda el usuario al registrarse.
-- =====================================================================

alter table perfiles
  add column email text,
  add column pendiente boolean not null default false;

update perfiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function crear_perfil_nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_primero boolean;
begin
  -- Evita que dos registros simultáneos se conviertan ambos en "el primero"
  perform pg_advisory_xact_lock(hashtext('alta_perfiles'));
  v_primero := not exists (select 1 from perfiles);

  insert into perfiles (id, nombre, email, telefono, rol, activo, pendiente)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sin nombre'
    ),
    new.email,
    case when coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') end,
    case when v_primero then 'administrador' else 'operario' end::rol_usuario,
    v_primero,
    not v_primero
  );
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Siempre tiene que quedar al menos un administrador activo
-- ---------------------------------------------------------------------
create function proteger_ultimo_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.rol = 'administrador' and old.activo
     and (new.rol <> 'administrador' or not new.activo) then
    if not exists (
      select 1 from perfiles where rol = 'administrador' and activo and id <> old.id
    ) then
      raise exception 'Tiene que quedar al menos un administrador activo.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger proteger_ultimo_admin
  before update on perfiles
  for each row execute function proteger_ultimo_admin();

-- ---------------------------------------------------------------------
-- El panel ahora también cuenta las cuentas esperando aprobación
-- ---------------------------------------------------------------------
drop function resumen_panel();

create function resumen_panel()
returns table (
  cajas_afuera bigint,
  cajones_afuera bigint,
  direcciones_pendientes bigint,
  direcciones_atrasadas bigint,
  dias_alerta integer,
  cuentas_pendientes bigint
)
language sql stable security invoker set search_path = public as $$
  select
    coalesce(sum(saldo_cajas), 0),
    coalesce(sum(saldo_cajones), 0),
    count(*) filter (where estado = 'pendiente'),
    count(*) filter (where atrasada),
    (select dias_alerta from configuracion),
    (select count(*) from perfiles where pendiente)
  from vista_direcciones;
$$;

revoke execute on function resumen_panel from public, anon;
grant execute on function resumen_panel to authenticated;

-- Tiempo real: el administrador ve aparecer las cuentas nuevas sin recargar
alter publication supabase_realtime add table perfiles;
