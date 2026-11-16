const CACHE = 'sm-app-v3';
const STATIC = /(\/|\.html|\.png|\.ico|\.webmanifest|\.css|\.woff2)$/;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !STATIC.test(url.pathname) || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (!isPage && url.search) return;
  const key = url.origin + (isPage ? url.pathname.replace(/index\.html$/, '') : url.pathname);
  const fresh = (async () => {
    const res = await fetch(key, { cache: 'no-cache', credentials: 'same-origin' });
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE);
      const old = await cache.match(key);
      await cache.put(key, res.clone());
      if (isPage && old) {
        const tag = (r) => r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length');
        const a = tag(old), b = tag(res);
        if (a && b && a !== b) for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'sm-update' });
      }
    }
    return res;
  })();
  e.respondWith((async () => {
    const hit = await (await caches.open(CACHE)).match(key);
    if (hit) { fresh.catch(() => {}); return hit; }
    return fresh;
  })());
  e.waitUntil(fresh.catch(() => {}));
});
