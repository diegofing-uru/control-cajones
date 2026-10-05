/**
 * Interpreta lo que la persona escribe en "Email o celular".
 * Celulares de Uruguay: acepta 099 123 456, 99123456, +598 99 123 456, 598 99123456…
 * y los normaliza a formato internacional: +59899123456.
 */
export type Identificador = { email: string } | { phone: string };

export function normalizarCelularUY(texto: string): string | null {
  let d = texto.replace(/[^\d]/g, '');
  if (d.startsWith('00598')) d = d.slice(5);
  else if (d.startsWith('598')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^9\d{7}$/.test(d) ? `+598${d}` : null;
}

export function interpretarIdentificador(texto: string): Identificador | string {
  const t = texto.trim();
  if (!t) return 'Ingresá tu email o tu celular.';
  if (t.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { email: t.toLowerCase() } : 'Revisá el email.';
  }
  const phone = normalizarCelularUY(t);
  return phone ? { phone } : 'Ingresá un celular uruguayo válido (ej: 099 123 456).';
}

/** +59899123456 → 099 123 456 */
export function mostrarCelular(e164: string | null): string {
  if (!e164) return '';
  const d = e164.replace('+598', '0');
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : e164;
}
