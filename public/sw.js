const CACHE_NAME = 'love-of-minnesota-v1';
const RUNTIME_CACHE = 'love-of-minnesota-runtime-v1';

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/fav.png',
  '/logo.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  const url = new URL(requestUrl);
  
  // Skip non-GET requests (POST, PUT, DELETE, etc.) - always go to network
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (Supabase, Mapbox, etc.) - let browser handle
  // This is critical - we must NOT intercept Supabase/auth requests
  // Check both origin and common external domains
  const isCrossOrigin = !requestUrl.startsWith(self.location.origin);
  const isExternalDomain = requestUrl.includes('supabase.co') || 
                          requestUrl.includes('mapbox.com') ||
                          requestUrl.includes('stripe.com');
  
  if (isCrossOrigin || isExternalDomain) {
    return; // Let browser handle cross-origin requests directly
  }

  // Never cache API routes - always fetch fresh
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request, {
        credentials: 'include', // Ensure cookies/auth headers are sent
        cache: 'no-store', // Never cache API responses
      }).catch(() => {
        // If network fails, return error (don't use cache for API)
        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
    );
    return;
  }

  // Never cache auth-related routes
  if (url.pathname.includes('/auth/') || 
      url.pathname.includes('/login') || 
      url.pathname.includes('/signup') ||
      url.pathname.includes('/sign-in') ||
      url.pathname.includes('/sign-up')) {
    event.respondWith(
      fetch(event.request, {
        credentials: 'include',
        cache: 'no-store',
      })
    );
    return;
  }

  // For other requests, use network-first with cache fallback
  event.respondWith(
    fetch(event.request, {
      credentials: 'include', // Ensure cookies/auth headers are sent
    })
      .then((response) => {
        // Only cache successful responses for static assets
        // Don't cache HTML pages that might have dynamic content
        if (response.status === 200 && 
            (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot|css|js)$/i) ||
             url.pathname === '/' || 
             url.pathname.startsWith('/_next/static/'))) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      })
      .catch(() => {
        // Network failed, try cache for static assets only
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If it's a navigation request and we have a cached index, return that
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
      })
  );
});

