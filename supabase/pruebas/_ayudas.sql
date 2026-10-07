-- Ayudas para las pruebas de la base. scripts/probar-base.mjs las carga antes de cada archivo,
-- todo dentro de una transacción que termina en error a propósito: NADA queda guardado.
-- Nunca poner COMMIT en un archivo de pruebas.

create temp table pruebas_ok (nombre text) on commit drop;
create temp table usuarios_prueba (nombre text primary key, id uuid) on commit drop;
create temp table movimientos_prueba (nombre text primary key, id uuid) on commit drop;

/** Crea un usuario de prueba: rol 'administrador' | 'operario' | 'inactivo' | 'pendiente' */
create function pg_temp.usuario(p_nombre text, p_tipo text) returns uuid language plpgsql as $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
    values (u, 'zz-' || u || '@prueba.local', json_build_object('nombre', 'ZZ ' || p_nombre));
  update perfiles set
    rol = case when p_tipo = 'administrador' then 'administrador' else 'operario' end::rol_usuario,
    activo = p_tipo in ('administrador', 'operario'),
    pendiente = p_tipo = 'pendiente'
  where id = u;
  insert into usuarios_prueba values (p_nombre, u);
  return u;
end $$;

create function pg_temp.id(p_nombre text) returns uuid language sql as $$
  select id from usuarios_prueba where nombre = p_nombre
$$;

/** Las funciones siguientes se ejecutan como este usuario (auth.uid()) */
create function pg_temp.como(p_nombre text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.id(p_nombre), 'role', 'authenticated')::text, true)
$$;

create function pg_temp.igual(p_nombre text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
  if p_obtenido is distinct from p_esperado then
    raise exception 'FALLA: % → obtuve «%», esperaba «%»', p_nombre, coalesce(p_obtenido, 'null'), coalesce(p_esperado, 'null');
  end if;
  insert into pruebas_ok values (p_nombre);
end $$;

/** Ejecuta p_sql y verifica que falle con un mensaje que contenga p_fragmento */
create function pg_temp.falla(p_nombre text, p_sql text, p_fragmento text) returns void language plpgsql as $$
declare v_error text;
begin
  begin
    execute p_sql;
  exception when others then
    v_error := sqlerrm;
  end;
  if v_error is null then
    raise exception 'FALLA: % → debía dar error y funcionó', p_nombre;
  end if;
  if position(p_fragmento in v_error) = 0 then
    raise exception 'FALLA: % → el error fue «%», esperaba que dijera «%»', p_nombre, v_error, p_fragmento;
  end if;
  insert into pruebas_ok values (p_nombre);
end $$;

/** Saldo y estado de una dirección: 'cajas/cajones/estado' */
create function pg_temp.saldo(p_calle text) returns text language sql as $$
  select saldo_cajas || '/' || saldo_cajones || '/' || estado from direcciones where calle = p_calle
$$;

/** Guarda el id de un movimiento con un nombre, para usarlo después: pg_temp.guardar('x', (registrar_movimiento(...)).id) */
create function pg_temp.guardar(p_nombre text, p_id uuid) returns void language sql as $$
  insert into movimientos_prueba values (p_nombre, p_id)
$$;

create function pg_temp.mov(p_nombre text) returns uuid language sql as $$
  select id from movimientos_prueba where nombre = p_nombre
$$;

/** En una mudanza: el otro movimiento (la llegada si se pasa la salida, y al revés) */
create function pg_temp.par(p_id uuid) returns uuid language sql as $$
  select b.id from movimientos a join movimientos b on b.mudanza_id = a.mudanza_id and b.id <> a.id where a.id = p_id
$$;
