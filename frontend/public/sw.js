// BRUNO Service Worker v7 - Enhanced Push Notifications for Mobile
const SW_VERSION = 'v7';
const CACHE_NAME = 'bruno-' + SW_VERSION;

const NEVER_CACHE = ['/api/', '/ws/', 'chrome-extension', '/sockjs-node'];

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (NEVER_CACHE.some((p) => url.includes(p))) return;

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

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

// Enhanced push notification handler for mobile
self.addEventListener('push', (event) => {
  let data = {
    title: 'BRUNO',
    body: 'Tienes una nueva notificacion',
    icon: '/bruno-logo.png',
    badge: '/bruno-badge.png',
    url: '/',
    tag: 'bruno-notification',
    image: null,
    actions: [],
    vibrate: [100, 50, 100],
    renotify: false,
    silent: false,
    requireInteraction: false,
  };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { url: data.url, ...(data.data || {}) },
    vibrate: data.vibrate || [100, 50, 100],
    requireInteraction: data.requireInteraction || false,
    renotify: data.renotify || false,
    silent: data.silent || false,
  };

  // Rich notification image (shows large preview on mobile)
  if (data.image) {
    options.image = data.image;
  }

  // Merge server-sent actions with contextual defaults
  if (data.actions && data.actions.length > 0) {
    options.actions = data.actions.slice(0, 2); // Max 2 actions on most platforms
  } else if (data.tag === 'incoming_call') {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200, 100, 200];
    options.actions = [
      { action: 'accept', title: 'Aceptar' },
      { action: 'decline', title: 'Rechazar' },
    ];
  } else if (data.tag && data.tag.startsWith('message_')) {
    options.renotify = true;
    options.actions = [
      { action: 'reply', title: 'Responder' },
      { action: 'dismiss', title: 'Cerrar' },
    ];
  } else if (data.tag && data.tag.startsWith('comment_')) {
    options.renotify = true;
    options.actions = [
      { action: 'reply', title: 'Responder' },
      { action: 'dismiss', title: 'Cerrar' },
    ];
  } else if (data.tag && data.tag.startsWith('follower')) {
    options.actions = [{ action: 'view_profile', title: 'Ver perfil' }];
  } else if (data.tag && data.tag.startsWith('story_reaction')) {
    options.actions = [{ action: 'view_story', title: 'Ver historia' }];
  }

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = data.url || '/';

  if (event.action === 'accept' && data.call_id) url = `/chat?accept_call=${data.call_id}`;
  else if (event.action === 'decline' || event.action === 'dismiss') return;
  else if (event.action === 'reply') {
    if (data.kind === 'comment' && data.post_id) url = `/post/${data.post_id}`;
    else if (data.kind === 'message' && data.chat_id) url = `/chat?chat=${data.chat_id}`;
    else url = data.url || '/chat';
  }
  else if (event.action === 'view_profile') url = data.profile_url || data.url || '/my-profile';
  else if (event.action === 'view_story') url = data.url || '/my-profile?tab=stories';

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
self.addEventListener('sync', () => {});
