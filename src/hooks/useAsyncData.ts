'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Patrón único de carga asíncrona usado por los contextos compartidos
 * (DashboardData, Wallets) y por los widgets de Inicio que todavía
 * consultan señales propias (Recomendaciones).
 *
 * - `loading` arranca en `true` y se apaga tras la primera carga; los
 *   `refetch()` siguientes corren en background SIN volver a encender
 *   `loading`, para que la UI no parpadee al refrescar (mismo criterio
 *   que tenían los contextos antes de este hook).
 * - `error` guarda un mensaje legible y se limpia al volver a cargar.
 * - En un fallo se conservan los datos previos (`data` no se vacía) — la
 *   UI prefiere mostrar lo último que se supo a quedarse en blanco.
 *
 * El `loader` debe ser estable (envolverlo en `useCallback`) salvo que
 * dependa de datos que cambian — en ese caso el hook vuelve a cargar
 * automáticamente cuando cambia, igual que un `useEffect` con deps.
 */
export function useAsyncData<T>(
  loader: () => Promise<T | null>,
  errorMessage: string
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const result = await loader()
      setData(result)
      setError(null)
    } catch (err) {
      console.error(errorMessage, err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [loader, errorMessage])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
