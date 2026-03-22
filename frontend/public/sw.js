// BRUNO Service Worker v4 - Push Notifications + Safari Cache Fix
const SW_VERSION = 'v4';
const CACHE_NAME = 'bruno-' + SW_VERSION;

// Always bypass cache for these patterns
const NEVER_CACHE = ['/api/', '/ws/', 'chrome-extension', '/sockjs-node'];

// Install - force immediate activation
self.addEventListener('install', () => {
  console.log('[SW] Installing', SW_VERSION);
  self.skipWaiting();
});

// Activate - purge all old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating', SW_VERSION);
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch - network-first, never cache HTML
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (NEVER_CACHE.some((p) => url.includes(p))) return;

  // HTML navigation requests: always network, never cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // All other assets: network-first with brief cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.match(/\.(js|css|png|jpg|webp|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification
self.addEventListener('push', (event) => {
  let data = {
    title: 'BRUNO',
    body: 'Tienes una nueva notificacion',
    icon: '/bruno-logo.png',
    badge: '/bruno-logo.png',
    url: '/',
    tag: 'bruno-notification',
  };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text(); }
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
    silent: false,
  };
  if (data.tag === 'incoming_call') {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200];
    options.actions = [
      { action: 'accept', title: 'Aceptar' },
      { action: 'decline', title: 'Rechazar' },
    ];
  } else if (data.tag?.startsWith('message_')) {
    options.actions = [
      { action: 'reply', title: 'Responder' },
      { action: 'dismiss', title: 'Cerrar' },
    ];
  }
  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || '/';
  if (event.action === 'accept' && data.call_id) url = `/chat?accept_call=${data.call_id}`;
  else if (event.action === 'decline' || event.action === 'dismiss') return;
  else if (event.action === 'reply') url = '/chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('notificationclose', () => {});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') console.log('[SW] Syncing messages...');
});
