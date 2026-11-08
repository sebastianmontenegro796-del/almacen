// Service worker: guarda la interfaz para que la app abra rápido y sin conexión.
// Los datos siempre se piden al servidor (no se guardan aquí).
const CACHE = 'seba-almacen-v5';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'config.js',
               'app-icon-192.png', 'app-icon-512.png', 'app-apple-touch-icon.png', 'logo-mt-192.png', 'logo-mt-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API y ntfy: directo a la red
  // Red primero (para recibir actualizaciones), caché si no hay conexión
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
