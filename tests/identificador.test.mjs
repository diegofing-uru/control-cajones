// Pruebas de cómo se interpreta lo que la persona escribe en "Email o celular".
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { interpretarIdentificador, mostrarCelular, normalizarCelularUY } from '../src/lib/identificador.ts';

describe('normalizarCelularUY', () => {
  test('acepta las formas habituales de escribir un celular uruguayo', () => {
    for (const texto of ['094878024', '94878024', '094 878 024', '+598 94 878 024', '598 94878024', '00598 94878024']) {
      assert.equal(normalizarCelularUY(texto), '+59894878024', texto);
    }
  });

  test('rechaza lo que no es un celular', () => {
    for (const texto of ['24001234', '0948780', '0948780245', 'hola']) {
      assert.equal(normalizarCelularUY(texto), null, texto);
    }
  });
});

describe('interpretarIdentificador', () => {
  test('email (en minúsculas) o celular', () => {
    assert.deepEqual(interpretarIdentificador(' Gaston@Mudanzas.uy '), { email: 'gaston@mudanzas.uy' });
    assert.deepEqual(interpretarIdentificador('094 878 024'), { phone: '+59894878024' });
  });

  test('mensajes de error', () => {
    assert.equal(typeof interpretarIdentificador(''), 'string');
    assert.equal(typeof interpretarIdentificador('gaston@'), 'string');
    assert.equal(typeof interpretarIdentificador('123'), 'string');
  });

  test('mostrarCelular vuelve al formato local', () => {
    assert.equal(mostrarCelular('+59894878024'), '094 878 024');
    assert.equal(mostrarCelular(null), '');
  });
});
