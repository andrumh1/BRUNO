// BRUNO Service Worker for Push Notifications
// Version 2 - Added cache busting and proper cleanup
const CACHE_NAME = 'bruno-v2';
const CACHE_VERSION = Date.now();

// Files to NOT cache (always fetch fresh)
const NO_CACHE = [
  '/api/',
  '/ws/',
  'chrome-extension'
];

// Install event - force update
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return clients.claim();
    })
  );
});

// Fetch event - Network first strategy for all requests
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip URLs that shouldn't be cached
  const url = event.request.url;
  if (NO_CACHE.some(pattern => url.includes(pattern))) {
    return;
  }
  
  // Network first strategy - always try network first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        // Only use cache as fallback for navigation
        return caches.match(event.request);
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'BRUNO',
    body: 'Tienes una nueva notificación',
    icon: '/bruno-icon.png',
    badge: '/bruno-icon.png',
    tag: 'bruno-notification',
    data: {}
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
    icon: data.icon || '/bruno-icon.png',
    badge: data.badge || '/bruno-icon.png',
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: data.type === 'incoming_call',
    actions: []
  };
  
  // Add actions for incoming calls
  if (data.type === 'incoming_call') {
    options.actions = [
      { action: 'accept', title: 'Aceptar', icon: '/icons/phone.png' },
      { action: 'decline', title: 'Rechazar', icon: '/icons/phone-off.png' }
    ];
    options.tag = `call-${data.call_id}`;
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action, event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let url = '/';
  
  // Handle different notification types
  if (data.type === 'incoming_call') {
    if (event.action === 'accept') {
      url = `/chat/${data.chat_id}?accept_call=${data.call_id}`;
    } else if (event.action === 'decline') {
      // Just close, the backend will handle timeout
      return;
    } else {
      url = `/chat/${data.chat_id}`;
    }
  } else if (data.type === 'new_message') {
    url = `/chat/${data.chat_id}`;
  } else if (data.type === 'new_follower') {
    url = `/profile/${data.follower_id}`;
  } else if (data.type === 'post_like' || data.type === 'post_comment') {
    url = `/feed?post=${data.post_id}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if not
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    console.log('[SW] Syncing messages...');
    // Handle offline message sync here
  }
});
