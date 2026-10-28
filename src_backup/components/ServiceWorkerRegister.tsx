'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker para que la app sea instalable (PWA). No
 * renderiza nada — es puro efecto secundario. Vive en su propio
 * componente para poder montarlo en el layout raíz sin convertir todo
 * el layout en un client component innecesariamente extenso.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Error registrando el service worker:', err)
      })
    }
  }, [])

  return null
}
