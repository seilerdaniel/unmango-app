'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { computeSplitShare, buildSplitExpenseMessage, buildWhatsAppLink } from '@/lib/splitExpense'
import { Users, X, MessageCircle } from 'lucide-react'

interface SplitExpenseToolProps {
  onDebtCreated?: () => void
}

/**
 * Divide un gasto entre varias personas y genera un link directo de
 * WhatsApp con el monto que le toca a cada una. Si cargás el nombre de
 * la otra persona, además crea una deuda "me deben" en Deudas y
 * Préstamos por su parte — así queda registrado, no es solo un cálculo
 * que se pierde.
 */
export default function SplitExpenseTool({ onDebtCreated }: SplitExpenseToolProps) {
  const { formatAmount } = usePrivacy()
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [peopleCount, setPeopleCount] = useState('2')
  const [counterpartyName, setCounterpartyName] = useState('')
  const [bankAlias, setBankAlias] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const share =
    Number(totalAmount) > 0 && Number(peopleCount) > 0 ? computeSplitShare(Number(totalAmount), Number(peopleCount)) : null

  function resetForm() {
    setDescription('')
    setTotalAmount('')
    setPeopleCount('2')
    setCounterpartyName('')
    setBankAlias('')
    setSavedMessage(null)
  }

  async function handleRegisterAndShare() {
    if (share === null || !description.trim()) return

    // Registrar en Deudas y Préstamos es opcional — solo si cargaste
    // con quién es. Si no, igual podés generar el mensaje de WhatsApp
    // sin que quede guardado nada (por ejemplo, para calcular rápido
    // sin llevar un registro formal).
    if (counterpartyName.trim()) {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('debts').insert([
          {
            user_id: user.id,
            description: description.trim(),
            counterparty_name: counterpartyName.trim(),
            debt_type: 'me_deben',
            currency: 'ARS',
            total_amount: share,
            remaining_amount: share,
          },
        ])
        if (error) {
          alert('Error al registrar la deuda: ' + error.message)
          console.error('Error creando deuda desde dividir gasto:', error)
        } else {
          setSavedMessage('Registrado en Deudas y Préstamos ✓')
          if (onDebtCreated) onDebtCreated()
        }
      }
      setSaving(false)
    }
  }

  function handleSendWhatsApp() {
    if (share === null) return
    const message = buildSplitExpenseMessage(description || 'gasto compartido', formatAmount(share), bankAlias || undefined)
    window.open(buildWhatsAppLink(message), '_blank')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold py-3 rounded-2xl transition cursor-pointer shadow-sm"
      >
        <Users size={15} className="text-emerald-600" /> Dividir Gasto
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users size={16} className="text-emerald-600" /> Dividir Gasto
              </h3>
              <button
                onClick={() => {
                  setIsOpen(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <input
              type="text"
              placeholder="¿Qué gasto es? (ej. Cena del viernes)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-800 dark:text-gray-100"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Monto total</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="10000"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Entre cuántos</label>
                <input
                  type="number"
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(e.target.value)}
                  min="2"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="Nombre de la otra persona (opcional)"
              title="Si lo cargás, además queda registrado en Deudas y Préstamos"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-800 dark:text-gray-100"
            />

            <input
              type="text"
              placeholder="Tu alias bancario (opcional, va en el mensaje)"
              value={bankAlias}
              onChange={(e) => setBankAlias(e.target.value)}
              className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-800 dark:text-gray-100"
            />

            {share !== null && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3.5 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  Le toca a cada uno
                </p>
                <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">{formatAmount(share)}</p>
              </div>
            )}

            {savedMessage && <p className="text-[11px] text-emerald-600 font-semibold">{savedMessage}</p>}

            <div className="flex gap-2">
              {counterpartyName.trim() && (
                <button
                  onClick={handleRegisterAndShare}
                  disabled={saving || share === null || !description.trim()}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Registrar deuda'}
                </button>
              )}
              <button
                onClick={handleSendWhatsApp}
                disabled={share === null}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
