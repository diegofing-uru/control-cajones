// Genera dist-demo/index.html: la app en modo demo como una única página autocontenida
// (JS, fuentes e imágenes embebidos). Funciona en cualquier hosting.
// DEMO_BASE_URL (ej. /control-cajones) es la carpeta donde se publica; vacío = raíz del dominio.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.env.DEMO_BASE_URL ?? '').replace(/\/+$/, '');
const salidaExpo = 'dist-web';
rmSync(salidaExpo, { recursive: true, force: true });

execSync(`npx expo export --platform web --output-dir ${salidaExpo}`, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CI: '1',
    EXPO_PUBLIC_DEMO: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'demo',
    DEMO_BASE_URL: base,
  },
});

const dirJs = join(salidaExpo, '_expo/static/js/web');
const archivoJs = readdirSync(dirJs).find((f) => f.endsWith('.js'));
let js = readFileSync(join(dirJs, archivoJs), 'utf8');

// Solo se embeben las fuentes que usa la app (el resto de las referencias nunca se cargan)
const fuentes = ['Ionicons.', 'Barlow_400Regular.', 'Barlow_500Medium.', 'Barlow_600SemiBold.', 'BarlowCondensed_600SemiBold.', 'BarlowCondensed_700Bold.'];
const prefijo = `${base}/assets/node_modules/`.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const rutas = new Set([...js.matchAll(new RegExp(`"(${prefijo}[^"]+)"`, 'g'))].map((m) => m[1]));
for (const ruta of rutas) {
  const archivo = join(salidaExpo, ruta.slice(base.length));
  if (!existsSync(archivo)) continue;
  const esFuente = ruta.endsWith('.ttf');
  if (esFuente && !fuentes.some((f) => ruta.includes(f))) continue;
  const mime = esFuente ? 'font/ttf' : 'image/png';
  js = js.replaceAll(`"${ruta}"`, `"data:${mime};base64,${readFileSync(archivo).toString('base64')}"`);
}

js = js.replaceAll('</script', '<\\/script');
const html = readFileSync('scripts/plantilla-demo.html', 'utf8')
  .replace('/*BASE*/', () => JSON.stringify(`${base}/`))
  .replace('/*APP*/', () => js);

mkdirSync('dist-demo', { recursive: true });
writeFileSync('dist-demo/index.html', html);
// GitHub Pages sirve 404.html en rutas desconocidas: así recargar en /login no da error
writeFileSync('dist-demo/404.html', html);
rmSync(salidaExpo, { recursive: true, force: true });
console.log(`Demo lista: dist-demo/index.html (${(html.length / 1e6).toFixed(1)} MB)`);
