// Corre las pruebas de supabase/pruebas/*.sql contra la base del proyecto vinculado.
// Cada archivo va dentro de una transacción que termina SIEMPRE en error a propósito
// (PRUEBAS_OK o FALLA), así que nada de lo que hacen las pruebas queda guardado.
// Uso: npm run test:base   (necesita `supabase login` y `supabase link` hechos)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const carpeta = 'supabase/pruebas';
const ayudas = readFileSync(join(carpeta, '_ayudas.sql'), 'utf8');
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.sql') && !f.startsWith('_')).sort();
const temporal = mkdtempSync(join(tmpdir(), 'pruebas-base-'));

let fallas = 0;
for (const archivo of archivos) {
  const pruebas = readFileSync(join(carpeta, archivo), 'utf8');
  if (/^\s*(commit|rollback)\b/im.test(pruebas)) {
    console.error(`✖ ${archivo}: no puede tener COMMIT ni ROLLBACK (las pruebas no deben guardar nada)`);
    fallas++;
    continue;
  }
  const sql = [
    'begin;',
    ayudas,
    pruebas,
    // Termina siempre en error: la transacción se deshace y el mensaje trae el resultado
    `do $$ begin raise exception 'PRUEBAS_OK %', (select count(*) from pruebas_ok); end $$;`,
  ].join('\n');
  const ruta = join(temporal, archivo);
  writeFileSync(ruta, sql);

  let salida = '';
  try {
    salida = execFileSync('supabase', ['db', 'query', '--linked', '-f', ruta], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  salida = salida.replace(/\\+n/g, '\n').replace(/\\+"/g, '"');

  const ok = salida.match(/PRUEBAS_OK (\d+)/);
  const falla = salida.match(/FALLA: ([^\n]*?)(?:\n|CONTEXT:|$)/);
  if (ok) {
    console.log(`✔ ${archivo} (${ok[1]} verificaciones)`);
  } else {
    fallas++;
    console.error(`✖ ${archivo}\n  ${falla ? falla[1].trim() : salida.trim().split('\n').slice(-3).join('\n  ')}`);
  }
}
rmSync(temporal, { recursive: true, force: true });

console.log(fallas ? `\n${fallas} archivo(s) con fallas` : `\nTodo bien: ${archivos.length} archivos de pruebas`);
process.exit(fallas ? 1 : 0);
