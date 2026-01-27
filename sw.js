const CACHE_NAME = 'stream-player-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// List of known ad domains or keywords to block (Simple example)
const BLOCK_LIST = [
  'doubleclick.net',
  'google-analytics.com',
  'googlesyndication.com',
  'adnxs.com',
  'outbrain.com',
  'taboola.com',
  'popads.net',
  'propellerads.com',
  'vidoomy.com',
  'adservice.google'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if the request is for a known ad domain
  const isAd = BLOCK_LIST.some(domain => url.hostname.includes(domain));

  if (isAd) {
    console.log('Blocking ad request:', event.request.url);
    event.respondWith(new Response('', { status: 204, statusText: 'No Content' }));
    return;
  }

  // Standard fetch for non-ad requests
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Fallback or handle offline
      });
    })
  );
});
