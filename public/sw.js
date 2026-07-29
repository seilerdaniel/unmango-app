// Service worker mínimo para que UnMango sea instalable como PWA.
//
// Estrategia: network-first para todo (siempre intenta traer la
// versión más nueva de la red primero, porque los datos financieros
// tienen que ser frescos), con un fallback al cache solo si no hay
// conexión — así la app abre igual sin internet (aunque sin datos
// actualizados), en vez de mostrar el error de "sin conexión" del
// navegador.
const CACHE_NAME = 'unmango-shell-v1'
const SHELL_ASSETS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Solo interceptamos GET — nunca cacheamos ni interferimos con
  // POST/PATCH/DELETE (las mutaciones a Supabase tienen que ir directo
  // a la red siempre).
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Actualiza el cache del shell en segundo plano con la versión
        // fresca, sin bloquear la respuesta.
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
