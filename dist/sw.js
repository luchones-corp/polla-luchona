const CACHE_NAME = 'polla-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Skip API / auth / realtime calls — always network
  if (url.pathname.includes('/rest/') || url.pathname.includes('/auth/') || url.pathname.includes('/realtime/')) return

  // Navigation requests (HTML pages): network-first, fall back to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
    )
    return
  }

  // Hashed static assets (Vite adds content hash): cache-first
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(r => {
        if (r) return r
        return fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
          return res
        })
      })
    )
    return
  }

  // Everything else: network-first
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// Push notifications
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {}
  const title = data.title || 'La Polla'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: { url: data.url || '/' },
    tag: data.tag || 'default',
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(clients.openWindow(url))
})
