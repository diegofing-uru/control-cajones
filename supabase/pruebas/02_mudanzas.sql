-- Mudanzas: los cajones pasan de una dirección a otra (registrar_mudanza, anular_movimiento)

select pg_temp.usuario('Ana', 'administrador');
select pg_temp.usuario('Oscar', 'operario');
select pg_temp.usuario('Ines', 'inactivo');

-- Entrega con "se muda a" -------------------------------------------------
select pg_temp.como('Oscar');
select registrar_movimiento(gen_random_uuid(), 'entrega', 10, 4, null, 'ZZ Origen 1', null, null, now(), 'app', null, 'ZZ  Destino   1');
update direcciones set contacto_nombre = 'Familia Prueba', contacto_telefono = '099000000' where calle = 'ZZ Origen 1';
select pg_temp.igual('al entregar se guarda el destino previsto (normalizado)',
  (select destino_previsto from direcciones where calle = 'ZZ Origen 1'), 'ZZ Destino 1');

-- Validaciones --------------------------------------------------------------
select pg_temp.falla('no se muda más de lo que hay',
  format('select registrar_mudanza(gen_random_uuid(), %L, 11, 0, null, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), 'ZZ Destino 1'),
  'no se puede mudar más');
select pg_temp.falla('el destino tiene que ser otra dirección',
  format('select registrar_mudanza(gen_random_uuid(), %L, 1, 0, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), (select id from direcciones where calle = 'ZZ Origen 1')),
  'tiene que ser distinta');
select pg_temp.falla('el destino tiene que ser otra dirección (escrita a mano)',
  format('select registrar_mudanza(gen_random_uuid(), %L, 1, 0, null, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), 'zz origen 1'),
  'tiene que ser distinta');
select pg_temp.falla('hay que indicar el destino',
  format('select registrar_mudanza(gen_random_uuid(), %L, 1, 0, null, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), '  '),
  'a qué dirección se mudan');
select pg_temp.falla('sin cantidades no hay mudanza',
  format('select registrar_mudanza(gen_random_uuid(), %L, 0, 0, null, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), 'ZZ Destino 1'),
  'al menos una caja');
select pg_temp.igual('una mudanza fallida no crea el destino', (select count(*) from direcciones where calle = 'ZZ Destino 1')::text, '0');

select pg_temp.como('Ines');
select pg_temp.falla('un usuario desactivado no registra mudanzas',
  format('select registrar_mudanza(gen_random_uuid(), %L, 1, 0, null, %L)', (select id from direcciones where calle = 'ZZ Origen 1'), 'ZZ Destino 1'),
  'no está activo');

-- Mudanza completa (la registra un operario) ------------------------------
select pg_temp.como('Oscar');
select pg_temp.guardar('salida', (registrar_mudanza('00000000-0000-4000-8000-00000000b001',
  (select id from direcciones where calle = 'ZZ Origen 1'), 10, 4, null, 'ZZ Destino 1', 'Apto 2', 'Se mudó hoy')).id);
select registrar_mudanza('00000000-0000-4000-8000-00000000b001',
  (select id from direcciones where calle = 'ZZ Origen 1'), 10, 4, null, 'ZZ Destino 1', 'Apto 2', 'Se mudó hoy');

select pg_temp.igual('el origen queda vacío y completado', pg_temp.saldo('ZZ Origen 1'), '0/0/completada');
select pg_temp.igual('el destino previsto del origen se borra', (select destino_previsto from direcciones where calle = 'ZZ Origen 1'), null);
select pg_temp.igual('el destino recibe los cajones', pg_temp.saldo('ZZ Destino 1'), '10/4/pendiente');
select pg_temp.igual('un reintento (mismo client_id) no muda dos veces',
  (select count(*) from movimientos where mudanza_id = (select mudanza_id from movimientos where id = pg_temp.mov('salida')))::text, '2');
select pg_temp.igual('el plazo del destino cuenta desde la mudanza', (select dias_pendiente from vista_direcciones where calle = 'ZZ Destino 1')::text, '0');
select pg_temp.igual('el contacto pasa al destino', (select contacto_nombre || ' ' || contacto_telefono from direcciones where calle = 'ZZ Destino 1'), 'Familia Prueba 099000000');
select pg_temp.igual('el destino nuevo guarda su referencia', (select referencia from direcciones where calle = 'ZZ Destino 1'), 'Apto 2');
select pg_temp.igual('la salida muestra a dónde fue',
  (select tipo || ' → ' || contraparte_calle from vista_movimientos where id = pg_temp.mov('salida')), 'mudanza_salida → ZZ Destino 1');
select pg_temp.igual('la llegada muestra de dónde vino',
  (select tipo || ' ← ' || contraparte_calle from vista_movimientos where id = pg_temp.par(pg_temp.mov('salida'))), 'mudanza_llegada ← ZZ Origen 1');
select pg_temp.igual('la mudanza guarda la nota', (select nota from movimientos where id = pg_temp.mov('salida')), 'Se mudó hoy');

-- Anular deshace las dos puntas -------------------------------------------
select pg_temp.falla('un operario no anula una mudanza',
  format('select anular_movimiento(%L, %L)', pg_temp.par(pg_temp.mov('salida')), 'Error de carga'), 'Solo un administrador');
select pg_temp.como('Ana');
select anular_movimiento(pg_temp.par(pg_temp.mov('salida')), 'Se cargó mal el destino');
select pg_temp.igual('anular (desde la llegada) devuelve los cajones al origen', pg_temp.saldo('ZZ Origen 1'), '10/4/pendiente');
select pg_temp.igual('y vacía el destino', pg_temp.saldo('ZZ Destino 1'), '0/0/completada');
select pg_temp.igual('las dos puntas quedan anuladas',
  (select string_agg(anulado::text, ',') from vista_movimientos where id in (pg_temp.mov('salida'), pg_temp.par(pg_temp.mov('salida')))), 'true,true');
select pg_temp.igual('los ajustes dicen que anularon una mudanza',
  (select string_agg(anula_tipo::text, ',' order by anula_tipo::text) from vista_movimientos where anula_id in (pg_temp.mov('salida'), pg_temp.par(pg_temp.mov('salida')))),
  'mudanza_llegada,mudanza_salida');
select pg_temp.falla('no se anula dos veces (desde la otra punta)',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('salida'), 'Otra vez'), 'ya fue anulado');

-- Mudanza parcial a una dirección que ya existe, y retiro en el destino ---
select pg_temp.como('Oscar');
select registrar_movimiento(gen_random_uuid(), 'entrega', 1, 0, null, 'ZZ Destino 2');
update direcciones set contacto_nombre = 'Otro Cliente', contacto_telefono = null where calle = 'ZZ Destino 2';
select pg_temp.guardar('salida2', (registrar_mudanza(gen_random_uuid(),
  (select id from direcciones where calle = 'ZZ Origen 1'), 6, 4, (select id from direcciones where calle = 'ZZ Destino 2'))).id);
select pg_temp.igual('mudanza parcial: lo que no se mudó queda en el origen', pg_temp.saldo('ZZ Origen 1'), '4/0/pendiente');
select pg_temp.igual('se suma a lo que ya había en el destino', pg_temp.saldo('ZZ Destino 2'), '7/4/pendiente');
select pg_temp.igual('no pisa el contacto que ya tenía el destino', (select contacto_nombre from direcciones where calle = 'ZZ Destino 2'), 'Otro Cliente');

select registrar_movimiento(gen_random_uuid(), 'retiro', 7, 4, (select id from direcciones where calle = 'ZZ Destino 2'));
select pg_temp.igual('después de la mudanza se retira en el destino', pg_temp.saldo('ZZ Destino 2'), '0/0/completada');

select pg_temp.como('Ana');
select pg_temp.falla('no se anula una mudanza si ya se retiró en el destino',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('salida2'), 'Tarde'), 'quedaría negativo');
