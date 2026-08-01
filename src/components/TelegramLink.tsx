'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { generateLinkingCode } from '@/lib/telegramLinkCode'
import { Send, RefreshCw, CheckCircle2, Unlink } from 'lucide-react'

export default function TelegramLink() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('telegram_links')
        .select('linking_code, linked_at')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setCode(data.linking_code)
        setLinked(data.linked_at !== null)
      }
    } catch (err) {
      console.error('Error cargando el estado de Telegram:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function handleGenerateCode() {
    setGenerating(true)
    try {
      if (!user) return

      const newCode = generateLinkingCode()

      const { error } = await supabase.from('telegram_links').upsert(
        {
          user_id: user.id,
          linking_code: newCode,
          telegram_chat_id: null,
          linked_at: null,
        },
        { onConflict: 'user_id' }
      )

      if (error) throw error
      setCode(newCode)
      setLinked(false)
    } catch (err) {
      alert('Error generando el código: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error generando código de Telegram:', err)
    } finally {
      setGenerating(false)
    }
  }

  async function handleUnlink() {
    if (!confirm('¿Desvincular tu cuenta de Telegram? El bot va a dejar de registrar gastos hasta que vincules de nuevo.')) return

    if (!user) return

    const { error } = await supabase.from('telegram_links').delete().eq('user_id', user.id)
    if (!error) {
      setCode(null)
      setLinked(false)
    } else {
      alert('Error al desvincular: ' + error.message)
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
        <Send size={16} className="text-sky-500" /> Vincular Telegram
      </h3>

      {linked ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Telegram vinculado — mandale mensajes tipo &quot;Gasto 4500
            café&quot; a tu bot.
          </p>
          <button
            onClick={handleUnlink}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-rose-600 cursor-pointer"
          >
            <Unlink size={12} /> Desvincular
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Generá un código y mandáselo a tu bot de Telegram para vincular tu cuenta. Necesitás
            haber creado el bot vos mismo primero (ver{' '}
            <code className="text-[10px]">supabase/functions/telegram-webhook/README.md</code>).
          </p>

          {code && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Tu código</p>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-widest">{code}</p>
            </div>
          )}

          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="w-full flex items-center justify-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generando...' : code ? 'Generar nuevo código' : 'Generar código'}
          </button>
        </div>
      )}
    </div>
  )
}
