-- Los días pendientes se cuentan por fecha de calendario en Uruguay, no por bloques de 24 horas.
-- Antes, algo dejado ayer a las 13:58 figuraba "Dejadas hoy" hasta hoy a las 13:58, mientras el
-- historial ya decía "Ayer". El aviso de "atrasada" usa la misma cuenta.
create or replace view vista_direcciones with (security_invoker = true) as
select
  d.*,
  case when d.estado = 'pendiente' and d.ultima_entrega_en is not null
       then (now() at time zone 'America/Montevideo')::date - (d.ultima_entrega_en at time zone 'America/Montevideo')::date
  end as dias_pendiente,
  (d.estado = 'pendiente'
   and d.ultima_entrega_en is not null
   and (now() at time zone 'America/Montevideo')::date - (d.ultima_entrega_en at time zone 'America/Montevideo')::date
       >= c.dias_alerta) as atrasada
from direcciones d
cross join configuracion c;
