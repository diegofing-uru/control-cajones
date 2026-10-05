const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaHora(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy.getTime() - 86400000).toDateString() === d.toDateString();
  if (mismoDia) return `Hoy, ${hh}:${mm}`;
  if (ayer) return `Ayer, ${hh}:${mm}`;
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${hh}:${mm}`;
}

export function diasTexto(dias: number | null): string {
  if (dias === null) return '';
  if (dias === 0) return 'Dejadas hoy';
  if (dias === 1) return 'Hace 1 día';
  return `Hace ${dias} días`;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function cantidades(cajas: number, cajones: number): string {
  const partes: string[] = [];
  if (cajas) partes.push(plural(Math.abs(cajas), 'caja', 'cajas'));
  if (cajones) partes.push(plural(Math.abs(cajones), 'cajón', 'cajones'));
  return partes.join(' y ');
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
