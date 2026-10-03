// sw.js – deixa o CardDex instalável como app (Chrome, Edge, celular).
// Não guarda nada em cache: tudo vem da internet, como no site normal.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
