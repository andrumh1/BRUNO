// BRUNO Service Worker for Push Notifications
// Version 3 - Full Push Notifications + Cache Busting
const CACHE_NAME = 'bruno-v3';
const CACHE_VERSION = Date.now();

// Files to NOT cache (always fetch fresh)
const NO_CACHE = [
  '/api/',
  '/ws/',
  'chrome-extension'
];

// Install event - force update
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3...');
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return clients.claim();
    })
  );
});

// Fetch event - Network first strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = event.request.url;
  if (NO_CACHE.some(pattern => url.includes(pattern))) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});

// Push notification event - Enhanced
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'BRUNO',
    body: 'Tienes una nueva notificación',
    icon: '/bruno-logo.png',
    badge: '/bruno-logo.png',
    url: '/',
    tag: 'bruno-notification'
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { url: data.url, ...data.data },
    vibrate: [100, 50, 100],
    requireInteraction: false,
    renotify: true,
    silent: false
  };
  
  // Special handling for different notification types
  if (data.tag === 'incoming_call') {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200];
    options.actions = [
      { action: 'accept', title: '✓ Aceptar' },
      { action: 'decline', title: '✗ Rechazar' }
    ];
  } else if (data.tag && data.tag.startsWith('message_')) {
    options.actions = [
      { action: 'reply', title: 'Responder' },
      { action: 'dismiss', title: 'Cerrar' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - Enhanced
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = data.url || '/';
  
  // Handle actions
  if (event.action === 'accept' && data.call_id) {
    url = `/chat?accept_call=${data.call_id}`;
  } else if (event.action === 'decline') {
    return; // Just close notification
  } else if (event.action === 'reply') {
    url = '/chat';
  } else if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('[SW] Syncing messages...');
  }
});
