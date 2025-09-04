// Tiny offline cache
const CACHE = 'todo-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-64.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(net => {
      const clone = net.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return net;
    }).catch(()=>caches.match('./')))
  );
});
