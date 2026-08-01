'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { loadPendingQueue, dequeueSynced, countPending } from '@/lib/offlineQueue'
import { applyPendingOperation } from '@/lib/offlineSync'
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
  const { user } = useUser()
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingCount, setPendingCount] = useState(() => (typeof window !== 'undefined' ? countPending() : 0))
  const [syncing, setSyncing] = useState(false)

  const flushQueue = useCallback(async () => {
    const queue = loadPendingQueue()
    if (queue.length === 0) return

    setSyncing(true)
    if (!user) {
      setSyncing(false)
      return
    }

    const syncedIds: string[] = []
    for (const item of queue) {
      const { error } = await applyPendingOperation(supabase, item, user.id)
      if (!error) {
        syncedIds.push(item.idLocal)
      } else {
        console.error('Error sincronizando operación pendiente:', error)
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
  }, [user, onSynced])

  useEffect(() => {
    // Si la app arranca ya online y quedó algo pendiente de una sesión
    // anterior sin conexión, lo sincroniza de una. El setSyncing(true)
    // que marca el comienzo es deliberado (UI de "sincronizando"); el
    // resto del trabajo de flushQueue es async.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [flushQueue])

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
          <RefreshCw size={14} className="animate-spin" /> Sincronizando {pendingCount || ''} cambio(s)...
        </>
      ) : (
        <>
          <CloudOff size={14} /> {pendingCount} cambio(s) sin sincronizar
        </>
      )}
    </div>
  )
}
