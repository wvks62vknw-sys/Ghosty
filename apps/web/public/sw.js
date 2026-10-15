// Ghosty service worker: shows push notifications and keeps the interface usable offline.
// Network first, so a newly shipped version always wins; the cache is only a fallback.
const CACHE = 'ghosty-shell-v1';
const SHELL = ['/', '/index.html', '/app.js', '/styles.css', '/manifest.webmanifest', '/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Never touch the brain's API or anything off-site.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && SHELL.includes(url.pathname)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined)).then((r) => r || Response.error())),
  );
});

self.addEventListener('push', (e) => {
  let msg = { title: 'Ghosty', body: '', tag: undefined, url: '/#agenda' };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    if (e.data) msg.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(String(msg.title).slice(0, 120), {
      body: String(msg.body).slice(0, 900),
      tag: msg.tag,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: typeof msg.url === 'string' && msg.url.startsWith('/') ? msg.url : '/#agenda' },
      renotify: !!msg.tag,
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || '/#agenda', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
          c.navigate?.(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
