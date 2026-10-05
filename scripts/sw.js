// Permite abrir la app sin señal: toda la app es una sola página, así que alcanza con
// guardar la última versión. Primero intenta la red (para recibir actualizaciones) y,
// si no hay conexión, usa la copia guardada. Los pedidos a Supabase no pasan por acá.
const INICIO = /*INICIO*/;
const CACHE = 'control-mudanzas-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(INICIO, copia));
        }
        return r;
      })
      .catch(() => caches.match(INICIO)),
  );
});
