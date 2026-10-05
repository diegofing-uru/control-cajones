// Genera la versión web como una única página autocontenida (JS, fuentes e imágenes embebidos).
//   node scripts/build-web.mjs         → dist-demo/: demo sin backend, con datos de prueba
//   node scripts/build-web.mjs --app   → dist-app/: app real instalable (PWA) conectada a Supabase;
//                                        necesita EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
// DEMO_BASE_URL (ej. /control-cajones) es la carpeta donde se publica; vacío = raíz del dominio.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esApp = process.argv.includes('--app');
const base = (process.env.DEMO_BASE_URL ?? '').replace(/\/+$/, '');
const salida = esApp ? 'dist-app' : 'dist-demo';
const nombre = esApp ? 'Control-Mudanzas' : 'Control de Cajones (demo)';

const entorno = esApp
  ? {
      EXPO_PUBLIC_DEMO: '0',
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    }
  : {
      EXPO_PUBLIC_DEMO: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'demo',
    };
if (esApp && (!entorno.EXPO_PUBLIC_SUPABASE_URL || !entorno.EXPO_PUBLIC_SUPABASE_ANON_KEY)) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY para generar la app.');
  process.exit(1);
}

const salidaExpo = 'dist-web';
rmSync(salidaExpo, { recursive: true, force: true });

execSync(`npx expo export --platform web --output-dir ${salidaExpo}`, {
  stdio: 'inherit',
  env: { ...process.env, CI: '1', ...entorno, DEMO_BASE_URL: base },
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

// Etiquetas extra del <head>: en la app, lo necesario para instalarla en el celular
const head = esApp
  ? [
      `<link rel="manifest" href="${base}/manifest.webmanifest" />`,
      `<link rel="icon" type="image/png" href="${base}/favicon.png" />`,
      `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />`,
      `<meta name="theme-color" content="#18222B" />`,
      `<meta name="apple-mobile-web-app-capable" content="yes" />`,
      `<meta name="mobile-web-app-capable" content="yes" />`,
      `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`,
      `<meta name="apple-mobile-web-app-title" content="${nombre}" />`,
      `<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register(${JSON.stringify(`${base}/sw.js`)});</script>`,
    ].join('\n')
  : '';

js = js.replaceAll('</script', '<\\/script');
const html = readFileSync('scripts/plantilla-web.html', 'utf8')
  .replace('<!--TITULO-->', () => nombre)
  .replace('<!--HEAD-->', () => head)
  .replace('/*BASE*/', () => JSON.stringify(`${base}/`))
  .replace('/*APP*/', () => js);

rmSync(salida, { recursive: true, force: true });
mkdirSync(salida, { recursive: true });
writeFileSync(join(salida, 'index.html'), html);

if (esApp) {
  for (const f of ['icono-192.png', 'icono-512.png', 'icono-maskable-512.png', 'apple-touch-icon.png', 'favicon.png']) {
    copyFileSync(join('assets/icono', f), join(salida, f));
  }
  writeFileSync(
    join(salida, 'manifest.webmanifest'),
    JSON.stringify(
      {
        name: nombre,
        short_name: nombre,
        lang: 'es-UY',
        start_url: `${base}/`,
        scope: `${base}/`,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#10171D',
        theme_color: '#18222B',
        icons: [
          { src: `${base}/icono-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}/icono-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}/icono-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      null,
      2,
    ),
  );
  writeFileSync(join(salida, 'sw.js'), readFileSync('scripts/sw.js', 'utf8').replace('/*INICIO*/', () => JSON.stringify(`${base}/`)));
}

rmSync(salidaExpo, { recursive: true, force: true });
console.log(`Lista: ${salida}/index.html (${(html.length / 1e6).toFixed(1)} MB)`);
