-- Registro de cuentas, roles y qué puede ver o tocar cada uno (seguridad)

-- Registro: el rol nunca sale de lo que manda la persona ----------------
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-00000000c001', 'zz-vivo@prueba.local', '{"nombre": "ZZ Vivo", "rol": "administrador"}');
select pg_temp.igual('una cuenta nueva queda como operario pendiente aunque pida ser administrador',
  (select rol || '/' || activo || '/' || pendiente from perfiles where id = '00000000-0000-4000-8000-00000000c001'), 'operario/false/true');
select pg_temp.igual('toma el nombre que escribió', (select nombre from perfiles where id = '00000000-0000-4000-8000-00000000c001'), 'ZZ Vivo');

insert into auth.users (id, phone) values ('00000000-0000-4000-8000-00000000c002', '59899999990');
select pg_temp.igual('una cuenta con celular guarda el teléfono con +598',
  (select telefono from perfiles where id = '00000000-0000-4000-8000-00000000c002'), '+59899999990');

-- Lo que ve cada uno (reglas de seguridad de la base) ---------------------
select pg_temp.usuario('Ana', 'administrador');
select pg_temp.usuario('Oscar', 'operario');
select pg_temp.usuario('Pedro', 'pendiente');
select pg_temp.como('Oscar');
select registrar_movimiento(gen_random_uuid(), 'entrega', 1, 0, null, 'ZZ Permisos 1');

create function pg_temp.cuantas_ve(p_nombre text) returns text language plpgsql as $$
declare n int;
begin
  perform pg_temp.como(p_nombre);
  set local role authenticated;
  select count(*) into n from direcciones where calle = 'ZZ Permisos 1';
  reset role;
  return n::text;
end $$;

select pg_temp.igual('un empleado activo ve las direcciones', pg_temp.cuantas_ve('Oscar'), '1');
select pg_temp.igual('una cuenta pendiente de aprobación no ve nada', pg_temp.cuantas_ve('Pedro'), '0');

select pg_temp.igual('sin iniciar sesión no se pueden registrar movimientos',
  has_function_privilege('anon', 'registrar_movimiento(uuid,tipo_movimiento,integer,integer,uuid,text,text,text,timestamptz,origen_movimiento,text,text)', 'execute')::text, 'false');
select pg_temp.igual('sin iniciar sesión no se pueden registrar mudanzas',
  has_function_privilege('anon', 'registrar_mudanza(uuid,uuid,integer,integer,uuid,text,text,text,timestamptz)', 'execute')::text, 'false');
select pg_temp.igual('nadie inserta movimientos directo (solo por las funciones que validan)',
  has_table_privilege('authenticated', 'movimientos', 'insert')::text, 'false');
select pg_temp.igual('nadie borra movimientos', has_table_privilege('authenticated', 'movimientos', 'delete')::text, 'false');
select pg_temp.igual('nadie cambia saldos a mano', has_column_privilege('authenticated', 'direcciones', 'saldo_cajas', 'update')::text, 'false');
select pg_temp.igual('sí se editan los datos de contacto', has_column_privilege('authenticated', 'direcciones', 'contacto_telefono', 'update')::text, 'true');
select pg_temp.igual('sí se edita a dónde se muda', has_column_privilege('authenticated', 'direcciones', 'destino_previsto', 'update')::text, 'true');

-- Siempre queda al menos un administrador activo --------------------------
update perfiles set rol = 'operario' where rol = 'administrador' and id <> pg_temp.id('Ana');
select pg_temp.falla('no se puede desactivar al único administrador',
  format('update perfiles set activo = false where id = %L', pg_temp.id('Ana')), 'al menos un administrador');
select pg_temp.falla('ni pasarlo a operario',
  format('update perfiles set rol = %L where id = %L', 'operario', pg_temp.id('Ana')), 'al menos un administrador');

update perfiles set rol = 'administrador' where id = pg_temp.id('Oscar');
update perfiles set activo = false where id = pg_temp.id('Ana');
select pg_temp.igual('con otro administrador, sí se puede desactivar', (select activo::text from perfiles where id = pg_temp.id('Ana')), 'false');

-- Panel ------------------------------------------------------------------
select pg_temp.como('Oscar');
select pg_temp.igual('el panel cuenta las cuentas esperando aprobación',
  ((select cuentas_pendientes from resumen_panel()) >= 2)::text, 'true');
