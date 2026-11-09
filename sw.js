// Offline-Helfer: Merkt sich alle Dateien des Spiels.
// Mit Internet wird immer zuerst die neueste Version geladen, ohne Internet die gemerkte.
const CACHE = 'hafenbillard-v2';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

async function fromCache(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') return caches.match('./index.html');
  return undefined;
}

async function networkFirst(request) {
  const cached = await fromCache(request);
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  });

  // Ohne gemerkte Datei muss das Netz antworten. Sonst wartet das Spiel nicht ewig auf schlechtes Netz.
  if (!cached) return network;
  const timeout = new Promise(resolve => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(event.request));
});
