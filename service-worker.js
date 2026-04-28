// Self-destructing service worker.
// When the browser detects this new version, it will clear all caches,
// unregister itself, and reload any open pages so they fetch fresh files.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => {
      try { c.navigate(c.url); } catch (_) { /* ignore */ }
    });
  })());
});
