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

        // 2. Inject "Deep Peeker" script into HTML pages
        if (response.headers.get('content-type')?.includes('text/html')) {
            const newHeaders = new Headers(response.headers);
            // Fix "Black Screen" by removing frame restrictions
            newHeaders.delete('X-Frame-Options');
            newHeaders.delete('Content-Security-Policy');

            return response.text().then(html => {
                const injectedHtml = html.replace('</head>', `
                    <script>
                        (function() {
                            const bc = window.BroadcastChannel ? new BroadcastChannel('stream_discovery') : null;
                            function report(url) {
                                if (!url || typeof url !== 'string' || !url.includes('.m3u8')) return;
                                window.parent.postMessage({ type: 'STREAM_FOUND', url: url }, '*');
                                if (bc) bc.postMessage({ type: 'STREAM_FOUND', url: url });
                            }

                            function registerSite(url) {
                                window.parent.postMessage({ type: 'REGISTER_SITE', url: url }, '*');
                            }

                            // 1. Hook XHR (Standard for HLS players)
                            const oldOpen = XMLHttpRequest.prototype.open;
                            XMLHttpRequest.prototype.open = function(method, url) {
                                report(url);
                                return oldOpen.apply(this, arguments);
                            };

                            // 2. Hook Fetch
                            const oldFetch = window.fetch;
                            window.fetch = function(input, init) {
                                const url = (typeof input === 'string') ? input : input.url;
                                report(url);
                                return oldFetch.apply(this, arguments);
                            };

                            // 3. Scan DOM & Globals
                            function scan() {
                                document.querySelectorAll('video, source').forEach(el => report(el.src));
                                if (window.hls && window.hls.url) report(window.hls.url);
                            }
                            setInterval(scan, 2000);

                            // 4. Block Popups/Redirects via window.open & Capture them
                            window.open = function(url) {
                                console.log("Blocked window.open attempt:", url);
                                if (url && url.startsWith('http')) {
                                    registerSite(url);
                                }
                                return {
                                    focus: function() {},
                                    close: function() {},
                                    location: {}
                                };
                            };

                            // 4b. Intercept Link Clicks that might be popups
                            document.addEventListener('click', function(e) {
                                const target = e.target.closest('a');
                                if (target && target.target === '_blank') {
                                    console.log("Intercepted _blank link click:", target.href);
                                    registerSite(target.href);
                                    // We don't necessarily want to block ALL user clicks, 
                                    // but we definitely want to register them.
                                }
                            }, true);

                            // 5. Intercept window.onbeforeunload/onunload to prevent redirect loops
                            window.onbeforeunload = null;
                            window.onunload = null;

                            // 6. Block location changes to different origins (experimental)
                            const originalLocation = window.location.origin;
                            setInterval(() => {
                                if (window.location.origin !== originalLocation && originalLocation !== "null") {
                                     // This is tricky because we might want some redirects
                                     // But many ads use this. 
                                     // For now, let's focus on window.open.
                                }
                            }, 1000);
                        })();
                    </script>
                </head>`);
                return new Response(injectedHtml, {
                    headers: newHeaders
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
