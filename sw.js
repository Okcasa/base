const CACHE_NAME = 'stream-player-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// List of known ad domains or keywords to block
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
  'adservice.google',
  'bet365.com',
  '1xbet.com',
  'mostbet.com',
  'parimatch.com',
  'yandex.ru/ads',
  'amazon-adsystem.com',
  'adform.net',
  'ads-twitter.com',
  'fbcdn.net/rsrc.php/v3/y6/r/mX',
  'adsafeprotected.com',
  'casalemedia.com',
  'criteo.com',
  'openx.net',
  'pubmatic.com',
  'rubiconproject.com',
  'smartadserver.com',
  'yieldmo.com',
  'ad-delivery.net',
  'ad-score.com',
  'adhigh.net',
  'adikteev.com',
  'admixer.net',
  'adotmob.com',
  'adpone.com',
  'adspirit.net',
  'adtarget.me',
  'adthrive.com',
  'adunit.pro',
  'adzerk.net',
  'aerserv.com',
  'amplitude.com',
  'app-measurement.com',
  'appier.net',
  'bidswitch.net',
  'bluekai.com',
  'btloader.com',
  'chartbeat.net',
  'clickcease.com',
  'conviva.com',
  'demdex.net',
  'dotomi.com',
  'everesttech.net',
  'exoclick.com',
  'eyeota.net',
  'hotjar.com',
  'id5-sync.com',
  'indexww.com',
  'liadm.com',
  'liveintent.com',
  'madspa.com',
  'media.net',
  'moatads.com',
  'nr-data.net',
  'onesignal.com',
  'quantserve.com',
  'rlcdn.com',
  'scorecardresearch.com',
  'serving-sys.com',
  'sharethrough.com',
  'sitescout.com',
  'socwv.com',
  'sonobi.com',
  'stackadapt.com',
  'tapad.com',
  'teads.tv',
  'triplelift.com',
  'underdogmedia.com',
  'unrulymedia.com'
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
