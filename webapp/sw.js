// Service worker: keeps every app file in a cache so TC420 Web works without
// internet after the first visit. precache.js is written by scripts/build.mjs
// when the site is built (it is missing in development, so nothing is cached
// there). A new version waits until the page asks it to take over.
importScripts('precache.js'); // self.PRECACHE = { version, files }

const PREFIX = 'tc420-web-';
const CACHE = PREFIX + self.PRECACHE.version;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(self.PRECACHE.files)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'version') event.source?.postMessage({ version: self.PRECACHE.version });
});

// Cache first: the app files never change within a version. Page loads (with
// or without ?sim=1) get the cached index.html.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const lookup =
    request.mode === 'navigate'
      ? caches.match('./', { cacheName: CACHE })
      : caches.match(request, { cacheName: CACHE, ignoreSearch: true });
  event.respondWith(lookup.then((hit) => hit || fetch(request)));
});
