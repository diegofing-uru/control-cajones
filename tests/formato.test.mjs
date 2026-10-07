// Pruebas de cómo se cuentan los días y se muestran fechas y cantidades.
// Se corren con `npm test` (hora de Uruguay) y en GitHub antes de publicar.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cantidades, diasCalendario, diasTexto, fechaHora, plural } from '../src/lib/formato.ts';

/** Fecha en hora local (Uruguay): uy('2026-10-06 13:58') */
const uy = (texto) => new Date(texto.replace(' ', 'T'));

describe('diasCalendario: cuenta días de calendario, no bloques de 24 horas', () => {
  test('caso real: mudanza ayer 13:58, mirado hoy 13:40 → hace 1 día (no "hoy")', () => {
    assert.equal(diasCalendario(uy('2026-10-06 13:58').toISOString(), uy('2026-10-07 13:40')), 1);
  });

  test('mismo día → 0', () => {
    assert.equal(diasCalendario(uy('2026-10-07 08:00').toISOString(), uy('2026-10-07 22:30')), 0);
  });

  test('ayer 23:59 mirado hoy 00:01 → 1', () => {
    assert.equal(diasCalendario(uy('2026-10-06 23:59').toISOString(), uy('2026-10-07 00:01')), 1);
  });

  test('cambio de mes y de año', () => {
    assert.equal(diasCalendario(uy('2026-10-31 18:00').toISOString(), uy('2026-11-01 09:00')), 1);
    assert.equal(diasCalendario(uy('2026-12-31 23:00').toISOString(), uy('2027-01-01 01:00')), 1);
  });

  test('15 días (el aviso de atrasada por defecto)', () => {
    assert.equal(diasCalendario(uy('2026-09-22 23:59').toISOString(), uy('2026-10-07 00:01')), 15);
  });
});

describe('diasTexto', () => {
  test('textos según los días', () => {
    assert.equal(diasTexto(null), '');
    assert.equal(diasTexto(0), 'Dejadas hoy');
    assert.equal(diasTexto(1), 'Hace 1 día');
    assert.equal(diasTexto(16), 'Hace 16 días');
  });
});

describe('fechaHora coincide con los días de las tarjetas', () => {
  test('algo de ayer dice "Ayer" en el historial y "Hace 1 día" en la tarjeta', () => {
    const ayer = new Date(Date.now() - 86400000).toISOString();
    assert.match(fechaHora(ayer), /^Ayer, \d\d:\d\d$/);
    assert.equal(diasTexto(diasCalendario(ayer)), 'Hace 1 día');
  });

  test('algo de hoy dice "Hoy" y "Dejadas hoy"', () => {
    const ahora = new Date().toISOString();
    assert.match(fechaHora(ahora), /^Hoy, \d\d:\d\d$/);
    assert.equal(diasTexto(diasCalendario(ahora)), 'Dejadas hoy');
  });
});

describe('cantidades', () => {
  test('singular, plural y combinaciones', () => {
    assert.equal(plural(1, 'caja', 'cajas'), '1 caja');
    assert.equal(cantidades(3, 2), '3 cajas y 2 cajones');
    assert.equal(cantidades(1, 1), '1 caja y 1 cajón');
    assert.equal(cantidades(0, 4), '4 cajones');
    assert.equal(cantidades(-5, 0), '5 cajas'); // los ajustes de anulación vienen en negativo
  });
});
