'use client'

import { useState } from 'react'
import { Plus, X, Mic, QrCode, Calculator, PenLine } from 'lucide-react'
import ArsUsdCalculator from '@/components/ArsUsdCalculator'
import VoiceExpenseInput from '@/components/VoiceExpenseInput'
import QrInvoiceScanner from '@/components/QrInvoiceScanner'

type ModalId = 'voice' | 'qr' | 'calculator' | null

interface SpeedDialFabProps {
  onTransactionAdded?: () => void
  /** Cambia a la pestaña Inicio y enfoca el campo de descripción del formulario de carga rápida. */
  onManualEntry: () => void
}

interface DialOption {
  id: 'voice' | 'qr' | 'calculator' | 'manual'
  label: string
  icon: typeof Mic
  color: string
}

const OPTIONS: DialOption[] = [
  { id: 'manual', label: 'Carga Manual', icon: PenLine, color: 'bg-amber-500 hover:bg-amber-600' },
  { id: 'calculator', label: 'Calculadora ARS/USD', icon: Calculator, color: 'bg-emerald-600 hover:bg-emerald-700' },
  { id: 'qr', label: 'Escanear QR', icon: QrCode, color: 'bg-cyan-600 hover:bg-cyan-700' },
  { id: 'voice', label: 'Cargar por Voz', icon: Mic, color: 'bg-rose-600 hover:bg-rose-700' },
]

/**
 * Botón central único que reemplaza los 4 botones flotantes sueltos
 * que había antes (uno por función). Al tocarlo, despliega las 4
 * opciones hacia arriba; elegir una cierra el menú y dispara esa
 * acción (abre el modal correspondiente, o para "Carga Manual" lleva a
 * Inicio y enfoca el formulario que ya está siempre visible ahí, en
 * vez de duplicarlo como un modal más).
 */
export default function SpeedDialFab({ onTransactionAdded, onManualEntry }: SpeedDialFabProps) {
  const [dialOpen, setDialOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalId>(null)

  function handleOptionClick(id: DialOption['id']) {
    setDialOpen(false)
    if (id === 'manual') {
      onManualEntry()
    } else {
      setActiveModal(id)
    }
  }

  return (
    <>
      {dialOpen && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDialOpen(false)} aria-hidden="true" />
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {dialOpen &&
          OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt.id)}
                title={opt.label}
                className={`w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition cursor-pointer ${opt.color}`}
              >
                <Icon size={18} />
              </button>
            )
          })}

        <button
          onClick={() => setDialOpen((v) => !v)}
          title={dialOpen ? 'Cerrar' : 'Agregar'}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/40 flex items-center justify-center transition cursor-pointer"
        >
          {dialOpen ? <X size={24} /> : <Plus size={24} />}
        </button>
      </div>

      <ArsUsdCalculator isOpen={activeModal === 'calculator'} onClose={() => setActiveModal(null)} />
      <VoiceExpenseInput
        isOpen={activeModal === 'voice'}
        onClose={() => setActiveModal(null)}
        onTransactionAdded={onTransactionAdded}
      />
      <QrInvoiceScanner
        isOpen={activeModal === 'qr'}
        onClose={() => setActiveModal(null)}
        onTransactionAdded={onTransactionAdded}
      />
    </>
  )
}
