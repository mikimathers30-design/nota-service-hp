const CACHE_NAME = 'nota-service-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://html2canvas.hertzen.com/dist/html2canvas.min.js'
];

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[Service Worker] Cache failed:', err);
      })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch Event - Strategi Cache First, fallback to Network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          // Refresh cache in background (stale-while-revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {
              // Network failed, keep cached version
            });
          
          return cachedResponse;
        }

        // Fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache if not valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone response untuk cache dan return
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            
            // Return offline fallback jika ada
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // Return error untuk assets lain
            return new Response('Offline - Resource not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Background Sync (untuk fitur pending data saat offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-nota') {
    console.log('[Service Worker] Background sync triggered');
    // Bisa tambahkan logic sync ke server di sini jika ada backend
  }
});

// Push Notification (opsional, perlu setup server)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Notifikasi baru',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/index.html'
    },
    actions: [
      {
        action: 'open',
        title: 'Buka Aplikasi'
      },
      {
        action: 'close',
        title: 'Tutup'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Nota Service HP', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/index.html')
    );
  }
});