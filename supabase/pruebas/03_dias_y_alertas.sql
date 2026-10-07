-- Días pendientes y aviso de atrasada (vista_direcciones): días de calendario en hora de Uruguay

update configuracion set dias_alerta = 15;

-- Fechas relativas a hoy en Uruguay
create temp table casos on commit drop as
select * from (values
  ('ZZ Dias hoy 00:01',            0,  time '00:01', 0),
  ('ZZ Dias ayer 23:59',           1,  time '23:59', 1),
  ('ZZ Dias ayer 00:01',           1,  time '00:01', 1),
  ('ZZ Dias hace 14 dias 23:59',   14, time '23:59', 14),
  ('ZZ Dias hace 15 dias 23:59',   15, time '23:59', 15)
) as x(calle, dias_atras, hora, esperado);

insert into direcciones (calle, saldo_cajas, estado, ultima_entrega_en)
select calle, 1, 'pendiente',
  (((now() at time zone 'America/Montevideo')::date - dias_atras) + hora) at time zone 'America/Montevideo'
from casos;

select pg_temp.igual('días de ' || calle, (select dias_pendiente from vista_direcciones v where v.calle = c.calle)::text, esperado::text)
from casos c;

select pg_temp.igual('con alerta a los 15 días: 14 días no está atrasada',
  (select atrasada::text from vista_direcciones where calle = 'ZZ Dias hace 14 dias 23:59'), 'false');
select pg_temp.igual('con alerta a los 15 días: 15 días sí está atrasada',
  (select atrasada::text from vista_direcciones where calle = 'ZZ Dias hace 15 dias 23:59'), 'true');

update configuracion set dias_alerta = 1;
select pg_temp.igual('cambiar la alerta a 1 día: lo de ayer pasa a atrasado',
  (select atrasada::text from vista_direcciones where calle = 'ZZ Dias ayer 23:59'), 'true');
select pg_temp.igual('cambiar la alerta a 1 día: lo de hoy no',
  (select atrasada::text from vista_direcciones where calle = 'ZZ Dias hoy 00:01'), 'false');

update direcciones set saldo_cajas = 0, estado = 'completada' where calle = 'ZZ Dias hace 15 dias 23:59';
select pg_temp.igual('una dirección completada no cuenta días ni está atrasada',
  (select coalesce(dias_pendiente::text, 'null') || '/' || atrasada from vista_direcciones where calle = 'ZZ Dias hace 15 dias 23:59'), 'null/false');
