const CACHE = 'brujula-shell-v1'
const SHELL = ['/','/manifest.webmanifest','/icon.svg']
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
  const html = await (await cache.match('/')).text()
  const assets = [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map(match => match[1])
  if (assets.length) await cache.addAll(assets)
  await self.skipWaiting()
})()))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { const copy=response.clone(); void caches.open(CACHE).then(cache=>cache.put('/',copy)); return response }).catch(() => caches.match('/')))
    return
  }
  if (url.pathname.startsWith('/assets/')) event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => { if(response.ok) void caches.open(CACHE).then(cache=>cache.put(request,response.clone())); return response })))
})
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { title: 'Brújula', body: event.data?.text() ?? 'Tenés una novedad.' } }
  event.waitUntil(self.registration.showNotification(payload.title || 'Brújula', {
    body: payload.body || 'Tenés una novedad.',
    data: { url: payload.url || '/notificaciones' },
    tag: payload.tag || undefined,
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/notificaciones'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client)
    if (existing) { existing.navigate(url); return existing.focus() }
    return self.clients.openWindow(url)
  }))
})
