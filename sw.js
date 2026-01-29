const CACHE_NAME = 'link-collector-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      
      return fetch(event.request).then(response => {
        const contentType = response.headers.get('content-type');
        
        // Only modify HTML or if it's a known problematic site like cineby.gd
        if (contentType?.includes('text/html') || url.hostname.includes('cineby.gd')) {
            const newHeaders = new Headers(response.headers);
            // Aggressively remove all frame-blocking headers
            newHeaders.delete('X-Frame-Options');
            newHeaders.delete('Content-Security-Policy');
            newHeaders.delete('Cross-Origin-Embedder-Policy');
            newHeaders.delete('Cross-Origin-Opener-Policy');

            return response.text().then(html => {
                // Inject simple popup catcher
                const injectedHtml = html.replace('</head>', `
                    <script>
                        (function() {
                            function registerSite(url) {
                                if (!url || url === 'about:blank' || url.startsWith('javascript:')) return;
                                window.parent.postMessage({ type: 'REGISTER_SITE', url: url }, '*');
                            }

                            // Capture window.open
                            const originalOpen = window.open;
                            window.open = function(url) {
                                console.log("Captured popup:", url);
                                registerSite(url);
                                return { focus: function() {}, close: function() {}, location: {} };
                            };

                            // Capture clicks on links that open in new tabs
                            document.addEventListener('click', function(e) {
                                const a = e.target.closest('a');
                                if (a && (a.target === '_blank' || a.rel === 'external')) {
                                    registerSite(a.href);
                                }
                            }, true);
                        })();
                    </script>
                </head>`);
                return new Response(injectedHtml, {
                    headers: newHeaders
                });
            });
        }
        return response;
      }).catch(() => {
        // Fallback for offline or errors
      });
    })
  );
});
