'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useHousehold } from '@/context/HouseholdContext'
import { generateHouseholdInviteCode } from '@/lib/householdInviteCode'
import { Home, RefreshCw, CheckCircle2, Unlink } from 'lucide-react'

interface HouseholdLinkProps {
  onLinkChanged?: () => void
}

export default function HouseholdLink({ onLinkChanged }: HouseholdLinkProps) {
  const { user } = useUser()
  const { link, partnerEmail, loading, refresh } = useHousehold()
  const [inviteInput, setInviteInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [accepting, setAccepting] = useState(false)

  // La relación de hogar ya la cachea HouseholdContext (se recarga al
  // cambiar la sesión o vía `refresh()`), así que acá no hay llamadas a
  // supabase.auth.getUser() ni a household_links al montar (ver AUDIT.md,
  // Fase 1f).

  async function handleGenerateCode() {
    if (!user) return
    setGenerating(true)

    const code = generateHouseholdInviteCode()
    const { error } = await supabase.from('household_links').insert([
      { user_a_id: user.id, invite_code: code, status: 'pending' },
    ])

    if (!error) {
      await refresh()
    } else {
      alert('Error al generar el código: ' + error.message)
      console.error('Error generando código de hogar:', error)
    }
    setGenerating(false)
  }

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteInput.trim()) return

    setAccepting(true)
    const { error } = await supabase.rpc('accept_household_invite', { p_invite_code: inviteInput.trim().toUpperCase() })

    if (!error) {
      setInviteInput('')
      await refresh()
      if (onLinkChanged) onLinkChanged()
    } else {
      alert('No se pudo vincular: ' + error.message)
      console.error('Error aceptando invitación de hogar:', error)
    }
    setAccepting(false)
  }

  async function handleUnlink() {
    if (!link) return
    if (!confirm('¿Desvincular el hogar? Se borran los gastos compartidos registrados — esto no se puede deshacer.')) return

    const { error } = await supabase.from('household_links').delete().eq('id', link.id)
    if (!error) {
      await refresh()
      if (onLinkChanged) onLinkChanged()
    } else {
      alert('Error al desvincular: ' + error.message)
    }
  }

  if (loading) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Home size={16} className="text-rose-500" /> Modo Hogar / Pareja
      </h3>

      {link?.status === 'active' ? (
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Vinculado con {partnerEmail || 'tu pareja'} — los gastos de hogar
            aparecen en Planes.
          </p>
          <button
            onClick={handleUnlink}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-rose-600 cursor-pointer"
          >
            <Unlink size={12} /> Desvincular
          </button>
        </div>
      ) : link?.status === 'pending' ? (
        <div className="space-y-2.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Generaste un código, esperando a que la otra persona lo cargue en su cuenta:
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-widest">
              {link.invite_code}
            </p>
          </div>
          <button
            onClick={handleUnlink}
            className="text-[11px] font-semibold text-gray-400 hover:text-rose-600 cursor-pointer"
          >
            Cancelar invitación
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Vinculá tu cuenta con la de tu pareja para llevar los gastos comunes de la casa (alquiler,
            expensas, super) sin mezclarlos con lo personal de cada uno.
          </p>

          <button
            onClick={handleGenerateCode}
            disabled={generating}
            className="w-full flex items-center justify-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generando...' : 'Generar código para invitar'}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            <span className="text-[10px] text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
          </div>

          <form onSubmit={handleAcceptInvite} className="flex gap-2">
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Código que te pasaron"
              className="flex-1 min-w-0 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100 uppercase"
            />
            <button
              type="submit"
              disabled={accepting || !inviteInput.trim()}
              className="shrink-0 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {accepting ? 'Uniendo...' : 'Unirme'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
