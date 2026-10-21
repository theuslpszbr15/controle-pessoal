// Service worker: deixa o app funcionando offline. Troque VERSION ao publicar mudanças.
const VERSION = 'cp-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './vendor/gsap.min.js',
  './vendor/matter.min.js',
  './vendor/three.module.min.js',
  './vendor/three.core.min.js',
  './js/app.js',
  './js/auth.js',
  './js/cloud.js',
  './vendor/firebase/firebase-app.js',
  './vendor/firebase/firebase-auth.js',
  './vendor/firebase/firebase-firestore.js',
  './js/store.js',
  './js/utils.js',
  './js/icons.js',
  './js/ui.js',
  './js/textmorph.js',
  './js/themes.js',
  './js/shared.js',
  './js/fx/background.js',
  './js/fx/physics.js',
  './js/fx/jar.js',
  './js/modules/inicio.js',
  './js/modules/financas.js',
  './js/modules/metas.js',
  './js/modules/contas.js',
  './js/modules/tarefas.js',
  './js/modules/habitos.js',
  './js/modules/agenda.js',
  './js/modules/compras.js',
  './js/modules/notas.js',
  './js/modules/foco.js',
  './js/modules/ajustes.js',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'cp-fonts').map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open('cp-fonts').then(async (cache) => {
        const hit = await cache.match(request);
        const net = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  e.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
