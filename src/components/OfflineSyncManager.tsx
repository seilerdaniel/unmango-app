'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database'
import { loadPendingQueue, dequeueSynced, countPending } from '@/lib/offlineQueue'
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react'

interface OfflineSyncManagerProps {
  onSynced?: () => void
}

/**
 * Vive montado una sola vez (en el layout de la página). No renderiza
 * nada visible salvo cuando hay algo que mostrar: un banner de "sin
 * conexión" mientras estás offline, o "sincronizando N..." mientras
 * vacía la cola de pendientes al recuperar internet.
 */
export default function OfflineSyncManager({ onSynced }: OfflineSyncManagerProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  async function flushQueue() {
    const queue = loadPendingQueue()
    if (queue.length === 0) return

    setSyncing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSyncing(false)
      return
    }

    const syncedIds: string[] = []
    for (const item of queue) {
      const insertRow = { ...item.payload, user_id: user.id } as Database['public']['Tables']['transactions']['Insert']
      const { error } = await supabase.from('transactions').insert([insertRow])
      if (!error) {
        syncedIds.push(item.idLocal)
      } else {
        console.error('Error sincronizando movimiento pendiente:', error)
        // Si falla por otro motivo que no sea conexión (ej. un dato
        // inválido), lo dejamos en la cola para no perderlo — mejor
        // que quede pendiente a que desaparezca sin haberse guardado.
      }
    }

    if (syncedIds.length > 0) {
      dequeueSynced(syncedIds)
      if (onSynced) onSynced()
    }

    setPendingCount(countPending())
    setSyncing(false)
  }

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(countPending())

    // Si la app arranca ya online y quedó algo pendiente de una sesión
    // anterior sin conexión, lo sincroniza de una.
    if (navigator.onLine) flushQueue()

    function handleOnline() {
      setIsOnline(true)
      flushQueue()
    }
    function handleOffline() {
      setIsOnline(false)
      setPendingCount(countPending())
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isOnline && !syncing && pendingCount === 0) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 ${
        !isOnline
          ? 'bg-amber-500 text-white'
          : syncing
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700 text-white'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff size={14} /> Sin conexión — lo que cargues se guarda en el celular y se sincroniza solo
        </>
      ) : syncing ? (
        <>
          <RefreshCw size={14} className="animate-spin" /> Sincronizando {pendingCount || ''} movimiento(s)...
        </>
      ) : (
        <>
          <CloudOff size={14} /> {pendingCount} movimiento(s) sin sincronizar
        </>
      )}
    </div>
  )
}
