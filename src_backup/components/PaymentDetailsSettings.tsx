'use client'

import { useEffect, useRef, useState } from 'react'
import { usePaymentDetails } from '@/context/PaymentDetailsContext'
import { useToast } from '@/context/ToastContext'
import { Landmark, CheckCircle2 } from 'lucide-react'

/**
 * Configuración de "Datos de Cobro": alias bancario, CBU o link de
 * Mercado Pago que se incluyen automáticamente en las tarjetas de
 * WhatsApp al dividir un gasto o cobrar el Modo Hogar. Se guarda en
 * `user_payment_details` vía PaymentDetailsContext (1:1 con el usuario).
 */
export default function PaymentDetailsSettings() {
  const { paymentDetails, loading, save } = usePaymentDetails()
  const { toast } = useToast()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const userEdited = useRef(false)

  // El contexto carga los datos de forma asíncrona: se copian al campo
  // cuando aparecen, pero sin pisar nada que el usuario haya escrito.
  useEffect(() => {
    if (paymentDetails && !userEdited.current) {
      setValue(paymentDetails)
    }
  }, [paymentDetails])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const ok = await save(value)
    setSaving(false)
    if (ok) {
      setSaved(true)
    } else {
      toast.error('Error al guardar los datos de cobro.')
    }
  }

  if (loading) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Landmark size={16} className="text-emerald-600" /> Datos de Cobro
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Cargá tu alias bancario, CBU o link de Mercado Pago — se agrega solo en los mensajes de
        &quot;Cobrar por WhatsApp&quot; al dividir un gasto o liquidar el hogar.
      </p>

      <form onSubmit={handleSave} className="space-y-2.5">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            userEdited.current = true
            setValue(e.target.value)
          }}
          placeholder="Ej: juan.perez (alias) o CVU 0000000000000000000000"
          className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar datos de cobro'}
        </button>
      </form>

      {saved && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
          <CheckCircle2 size={12} /> Guardado — se va a usar en las tarjetas de WhatsApp.
        </p>
      )}
    </div>
  )
}
