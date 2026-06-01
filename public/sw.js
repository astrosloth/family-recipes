const CACHE_NAME = 'family-recipes-cache-v1';
const STATIC_ASSETS = ['./', './index.html', './manifest.json', './favicon.svg'];

// Install Event - cache core static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core app shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log('[Service Worker] Removing old cache', key);
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event - intercept requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Exclude chrome-extension requests or dev hot-module reload paths
  if (
    requestUrl.protocol === 'chrome-extension:' ||
    requestUrl.pathname.includes('/@vite/') ||
    requestUrl.pathname.includes('/@id/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Check if we are fetching raw github content or recipe markdown files
  const isRecipeRequest =
    requestUrl.pathname.includes('/recipes/') ||
    requestUrl.hostname === 'raw.githubusercontent.com' ||
    requestUrl.hostname === 'api.github.com';

  // Always use Network-First for the HTML shell navigation & recipes to prevent stale bundle mismatch crashes!
  const isNetworkFirstRequest =
    isRecipeRequest ||
    event.request.mode === 'navigate' ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname.endsWith('/index.html') ||
    requestUrl.pathname.includes('/index.html');

  if (isNetworkFirstRequest) {
    // Network-first, fallback to cache (dynamic live updates + offline storage)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }
          // Clone the response and save it to the cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Offline: Loading resource from cache', event.request.url);
          return caches.match(event.request);
        })
    );
  } else {
    // Stale-while-revalidate for static shell assets to keep them fast
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
