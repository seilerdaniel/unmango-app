'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useToast } from '@/context/ToastContext'
import { CalendarDays, RefreshCw, CheckCircle2, Unlink } from 'lucide-react'

// Scope mínimo necesario: solo crear/editar/borrar eventos, no acceso
// completo al calendario (que permitiría, por ejemplo, borrarlo
// entero). accessType=offline + prompt=consent son necesarios para
// que Google devuelva un refresh_token la primera vez — sin eso, solo
// se obtiene un access_token que expira en ~1 hora y no sirve para
// sincronizar después de que el usuario cierra la sesión de Google.
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export default function GoogleCalendarLink() {
  const { user } = useUser()
  const { toast, confirmDialog } = useToast()
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      setConnected(!!data)
    } catch (err) {
      console.error('Error revisando la conexión con Google Calendar:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // checkConnection es async; sus setState ocurren post-await, no
    // sincrónicos en el effect (falso positivo de la regla).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkConnection()
  }, [checkConnection])

  useEffect(() => {
    // Si el usuario vuelve de autenticarse con Google (con el scope de
    // Calendar), Supabase deja el provider_refresh_token en la sesión.
    // Lo capturamos acá y lo guardamos nosotros — Supabase no lo
    // persiste en ningún lado por su cuenta.
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_refresh_token && session.provider_token) {
        try {
          const { error } = await supabase.from('google_calendar_tokens').upsert(
            {
              user_id: session.user.id,
              refresh_token: session.provider_refresh_token,
            },
            { onConflict: 'user_id' }
          )
          if (!error) {
            setConnected(true)
          } else {
            console.error('Error guardando el refresh_token de Google:', error)
          }
        } catch (err) {
          // Fallback graceful: si el upsert falla (red, RLS, tabla sin
          // correr) no tiramos la app — solo se loguea y el botón
          // "Conectar" sigue disponible para reintentar.
          console.error('Error inesperado guardando el refresh_token de Google:', err)
        }
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: CALENDAR_SCOPE,
          queryParams: { access_type: 'offline', prompt: 'consent' },
          redirectTo: `${window.location.origin}/`,
        },
      })
      if (error) {
        toast.error('No se pudo iniciar la conexión con Google: ' + error.message)
        setConnecting(false)
      }
      // Si no hay error, el navegador redirige a Google — no hace falta
      // hacer nada más acá.
    } catch (err) {
      console.error('Error inesperado conectando con Google Calendar:', err)
      toast.error('No se pudo conectar con Google. Probá de nuevo en un rato.')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    const ok = await confirmDialog({
      title: 'Desconectar Google Calendar',
      message: '¿Desconectar Google Calendar? Dejamos de crear/actualizar eventos hasta que vuelvas a conectar.',
      confirmText: 'Desconectar',
      variant: 'danger',
    })
    if (!ok) return

    if (!user) return

    try {
      const { error } = await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id)
      if (!error) {
        setConnected(false)
      } else {
        toast.error('Error al desconectar: ' + error.message)
      }
    } catch (err) {
      console.error('Error inesperado desconectando Google Calendar:', err)
      toast.error('No se pudo desconectar. Probá de nuevo en un rato.')
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    setLastSyncMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLastSyncMessage('Necesitás iniciar sesión para sincronizar tu calendario.')
        return
      }

      const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
        method: 'POST',
      })

      if (error) {
        const message = String((error as { message?: unknown })?.message ?? error)
        // Fallback graceful según el tipo de fallo: si el usuario todavía
        // no conectó el token (400 de la función), lo guiamos a conectar;
        // cualquier otra cosa (función no desplegada, red, Google API caída)
        // se muestra como error transitorio sin romper la UI.
        if (/no est[áa] conectado|400/i.test(message)) {
          setLastSyncMessage('Google Calendar no está conectado. Tocá "Conectar Google Calendar" y volvé a intentar.')
        } else {
          setLastSyncMessage('No se pudo sincronizar con Google Calendar. Verificá la conexión a internet y volvé a intentar.')
        }
        console.error('Error sincronizando con Google Calendar:', error)
        return
      }

      setLastSyncMessage(`Sincronizado: ${data?.synced ?? 0} evento(s) actualizados.`)
    } catch (err) {
      setLastSyncMessage('No se pudo sincronizar con Google Calendar. Verificá la conexión a internet y volvé a intentar.')
      console.error('Error inesperado sincronizando con Google Calendar:', err)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <CalendarDays size={16} className="text-blue-500" /> Google Calendar
      </h3>

      {connected ? (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Conectado — tus suscripciones, cuotas y deudas a pagar
            se sincronizan como eventos con recordatorio.
          </p>

          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>

          {lastSyncMessage && <p className="text-[11px] text-gray-500 dark:text-gray-400">{lastSyncMessage}</p>}

          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-rose-600 cursor-pointer"
          >
            <Unlink size={12} /> Desconectar
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Conectá tu Google Calendar para que tus suscripciones, cuotas y deudas a pagar
            aparezcan como eventos con recordatorio automático.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <CalendarDays size={13} />
            {connecting ? 'Conectando...' : 'Conectar Google Calendar'}
          </button>
        </div>
      )}
    </div>
  )
}
