self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { title: 'Brújula', body: event.data?.text() ?? 'Tenés una novedad.' } }
  event.waitUntil(self.registration.showNotification(payload.title || 'Brújula', {
    body: payload.body || 'Tenés una novedad.',
    data: { url: payload.url || '/notificaciones' },
    tag: payload.tag || undefined,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/notificaciones'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => 'focus' in client)
    if (existing) { existing.navigate(url); return existing.focus() }
    return self.clients.openWindow(url)
  }))
})
