-- Entregas, retiros y anulaciones (registrar_movimiento, anular_movimiento)

select pg_temp.usuario('Ana', 'administrador');
select pg_temp.usuario('Oscar', 'operario');
select pg_temp.usuario('Ines', 'inactivo');

-- Entregas ---------------------------------------------------------------
select pg_temp.como('Oscar');
select registrar_movimiento(gen_random_uuid(), 'entrega', 10, 4, null, 'ZZ Calle  Prueba   100', 'Apto 1');
select pg_temp.igual('la entrega crea la dirección (con espacios normalizados)', pg_temp.saldo('ZZ Calle Prueba 100'), '10/4/pendiente');
select pg_temp.igual('guarda la referencia de una dirección nueva',
  (select referencia from direcciones where calle = 'ZZ Calle Prueba 100'), 'Apto 1');

select registrar_movimiento(gen_random_uuid(), 'entrega', 1, 0, null, ' zz calle prueba 100 ');
select pg_temp.igual('no duplica la dirección por mayúsculas o espacios',
  (select count(*) from direcciones where calle_normalizada = 'zz calle prueba 100')::text, '1');
select pg_temp.igual('suma al saldo existente', pg_temp.saldo('ZZ Calle Prueba 100'), '11/4/pendiente');

select pg_temp.falla('sin cantidades no se registra',
  $$select registrar_movimiento(gen_random_uuid(), 'entrega', 0, 0, null, 'ZZ Calle Prueba 100')$$, 'al menos una caja');
select pg_temp.falla('no acepta cantidades negativas',
  $$select registrar_movimiento(gen_random_uuid(), 'entrega', -1, 2, null, 'ZZ Calle Prueba 100')$$, 'al menos una caja');
select pg_temp.falla('sin dirección no se registra',
  $$select registrar_movimiento(gen_random_uuid(), 'entrega', 1, 0, null, '   ')$$, 'Indicá una dirección');

-- Retiros ------------------------------------------------------------------
select registrar_movimiento('00000000-0000-4000-8000-00000000a001', 'retiro', 1, 0, null, 'ZZ Calle Prueba 100');
select registrar_movimiento('00000000-0000-4000-8000-00000000a001', 'retiro', 1, 0, null, 'ZZ Calle Prueba 100');
select pg_temp.igual('un reintento sin señal (mismo client_id) no descuenta dos veces', pg_temp.saldo('ZZ Calle Prueba 100'), '10/4/pendiente');

select pg_temp.falla('no se retiran más cajas de las que hay',
  $$select registrar_movimiento(gen_random_uuid(), 'retiro', 11, 0, null, 'ZZ Calle Prueba 100')$$, 'Solo hay 10 cajas');
select pg_temp.falla('no se retiran más cajones de los que hay',
  $$select registrar_movimiento(gen_random_uuid(), 'retiro', 0, 5, null, 'ZZ Calle Prueba 100')$$, 'Solo hay 4 cajones');
select pg_temp.falla('retiro en una dirección sin registros sugiere la mudanza',
  $$select registrar_movimiento(gen_random_uuid(), 'retiro', 1, 0, null, 'ZZ Calle Que No Existe 9')$$, 'registrá primero la mudanza');
select pg_temp.igual('un retiro fallido no crea la dirección',
  (select count(*) from direcciones where calle = 'ZZ Calle Que No Existe 9')::text, '0');

select registrar_movimiento(gen_random_uuid(), 'retiro', 10, 4, null, 'ZZ Calle Prueba 100');
select pg_temp.igual('retirar todo deja la dirección completada', pg_temp.saldo('ZZ Calle Prueba 100'), '0/0/completada');

select pg_temp.falla('los tipos de mudanza no van por registrar_movimiento',
  $$select registrar_movimiento(gen_random_uuid(), 'mudanza_salida', 1, 0, null, 'ZZ Calle Prueba 100')$$, 'Registrar mudanza');

-- Usuarios que no pueden registrar ---------------------------------------
select pg_temp.como('Ines');
select pg_temp.falla('un usuario desactivado no registra',
  $$select registrar_movimiento(gen_random_uuid(), 'entrega', 1, 0, null, 'ZZ Calle Prueba 100')$$, 'no está activo');

-- Anulaciones -------------------------------------------------------------
select pg_temp.como('Oscar');
select pg_temp.guardar('entrega200', (registrar_movimiento(gen_random_uuid(), 'entrega', 5, 2, null, 'ZZ Calle Prueba 200')).id);
select pg_temp.falla('un operario no puede anular',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('entrega200'), 'Error de carga'), 'Solo un administrador');

select pg_temp.como('Ana');
select pg_temp.falla('anular pide un motivo',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('entrega200'), 'x'), 'motivo');
select pg_temp.guardar('ajuste200', (anular_movimiento(pg_temp.mov('entrega200'), 'Se cargó en la dirección equivocada')).id);
select pg_temp.igual('anular una entrega corrige el saldo', pg_temp.saldo('ZZ Calle Prueba 200'), '0/0/completada');
select pg_temp.igual('el movimiento anulado queda marcado en el historial',
  (select anulado::text from vista_movimientos where id = pg_temp.mov('entrega200')), 'true');
select pg_temp.igual('el ajuste dice qué tipo anuló',
  (select anula_tipo::text from vista_movimientos where id = pg_temp.mov('ajuste200')), 'entrega');
select pg_temp.falla('no se anula dos veces',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('entrega200'), 'Otra vez'), 'ya fue anulado');
select pg_temp.falla('un ajuste no se anula',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('ajuste200'), 'Deshacer el ajuste'), 'Un ajuste no se puede anular');

select pg_temp.guardar('entrega300', (registrar_movimiento(gen_random_uuid(), 'entrega', 5, 0, null, 'ZZ Calle Prueba 300')).id);
select registrar_movimiento(gen_random_uuid(), 'retiro', 3, 0, null, 'ZZ Calle Prueba 300');
select pg_temp.falla('no se anula una entrega si ya se retiró parte (el saldo quedaría negativo)',
  format('select anular_movimiento(%L, %L)', pg_temp.mov('entrega300'), 'Error de carga'), 'quedaría negativo');
