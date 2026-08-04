/* sw.js — Service worker. Cachea el shell para que la app abra sin señal.
   Sube el número de CACHE cuando cambies archivos para forzar recarga. */
var CACHE = 'migym-v4';
var SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './catalogo.js',
  './config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // addAll falla entero si un archivo no está; cacheamos uno por uno tolerando fallos.
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // los POST de sincronización van directo a la red

  // Cache-first para el shell; red para todo lo demás con respaldo en caché.
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
