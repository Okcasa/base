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
  self.skipWaiting(); // Force activation on iOS
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Take control immediately
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
      if (response) return response;
      
      const fetchPromise = fetch(event.request).then(response => {
        const requestUrl = event.request.url.toLowerCase();

        // 1. Sniff for M3U8 stream links in Network
        const isStream = requestUrl.includes('.m3u8') || 
                         response.headers.get('content-type')?.includes('application/vnd.apple.mpegurl') ||
                         response.headers.get('content-type')?.includes('application/x-mpegurl');

        if (isStream && !requestUrl.includes('/segment') && !requestUrl.includes('.ts')) {
            broadcastStream(event.request.url);
        }

        // 2. Inject "Peeker" script into HTML pages
        if (response.headers.get('content-type')?.includes('text/html')) {
            return response.text().then(html => {
                const injectedHtml = html.replace('</head>', `
                    <script>
                        (function() {
                            console.log("PWA Peeker Injected");
                            function findStream() {
                                // Check video tags
                                document.querySelectorAll('video').forEach(v => {
                                    if (v.src && v.src.includes('.m3u8')) report(v.src);
                                    v.querySelectorAll('source').forEach(s => {
                                        if (s.src && s.src.includes('.m3u8')) report(s.src);
                                    });
                                });
                                // Check common HLS player globals
                                if (window.hls && window.hls.url) report(window.hls.url);
                            }
                            function report(url) {
                                // Try multiple ways to report back to the PWA
                                window.parent.postMessage({ type: 'STREAM_FOUND', url: url }, '*');
                                if (window.BroadcastChannel) {
                                    const bc = new BroadcastChannel('stream_discovery');
                                    bc.postMessage({ type: 'STREAM_FOUND', url: url });
                                }
                            }
                            setInterval(findStream, 2000);
                        })();
                    </script>
                </head>`);
                return new Response(injectedHtml, {
                    headers: response.headers
                });
            });
        }

        // 3. Ad Blocking / Redirect Blocking
        if (response.redirected && BLOCK_LIST.some(domain => response.url.includes(domain))) {
            return new Response('', { status: 204 });
        }
        return response;
      }).catch(() => {
        // Fallback
      });

      return fetchPromise;
    })
  );
});

function broadcastStream(url) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => {
            client.postMessage({ type: 'STREAM_FOUND', url: url });
        });
    });
}
