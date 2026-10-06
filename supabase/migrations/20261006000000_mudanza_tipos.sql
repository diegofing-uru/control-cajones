-- Tipos de movimiento para registrar una mudanza: los cajones pasan de una dirección a otra.
-- Va en una migración aparte porque un valor nuevo de un enum no se puede usar en la misma
-- transacción en la que se crea.
alter type tipo_movimiento add value if not exists 'mudanza_salida';
alter type tipo_movimiento add value if not exists 'mudanza_llegada';
