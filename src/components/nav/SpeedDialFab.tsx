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
  /** Ángulo en grados sobre un arco semicircular arriba del botón central (160°=izquierda, 20°=derecha). */
  angle: number
}

const RADIUS = 92

const OPTIONS: DialOption[] = [
  { id: 'manual', label: 'Carga Manual', icon: PenLine, color: 'bg-amber-500 hover:bg-amber-600', angle: 160 },
  { id: 'calculator', label: 'Calculadora ARS/USD', icon: Calculator, color: 'bg-emerald-600 hover:bg-emerald-700', angle: 113.33 },
  { id: 'qr', label: 'Escanear QR', icon: QrCode, color: 'bg-cyan-600 hover:bg-cyan-700', angle: 66.67 },
  { id: 'voice', label: 'Cargar por Voz', icon: Mic, color: 'bg-rose-600 hover:bg-rose-700', angle: 20 },
]

function arcOffset(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: RADIUS * Math.cos(rad), y: -RADIUS * Math.sin(rad) }
}

/**
 * Botón central único que reemplaza los 4 botones flotantes sueltos
 * que había antes. Al tocarlo, las 4 opciones se abren en abanico
 * sobre un arco arriba del botón (no apiladas en columna) con una
 * animación de escala + traslado escalonada por índice. Elegir una
 * cierra el menú y dispara esa acción.
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

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        {/* Las opciones siempre están montadas (no solo cuando dialOpen)
            para que la animación de apertura Y cierre se vea — si se
            desmontaran de golpe con dialOpen && (...), el cierre sería
            instantáneo sin transición. */}
        {OPTIONS.map((opt, index) => {
          const Icon = opt.icon
          const { x, y } = arcOffset(opt.angle)
          return (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(opt.id)}
              title={opt.label}
              aria-hidden={!dialOpen}
              tabIndex={dialOpen ? 0 : -1}
              style={{
                transform: dialOpen ? `translate(${x}px, ${y}px) scale(1)` : 'translate(0, 0) scale(0)',
                transitionDelay: dialOpen ? `${index * 40}ms` : '0ms',
              }}
              className={`absolute left-1/2 top-1/2 -ml-6 -mt-6 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-300 ease-out cursor-pointer ${
                dialOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              } ${opt.color}`}
            >
              <Icon size={18} />
            </button>
          )
        })}

        <button
          onClick={() => setDialOpen((v) => !v)}
          title={dialOpen ? 'Cerrar' : 'Agregar'}
          className="relative w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/40 flex items-center justify-center transition-transform duration-300 cursor-pointer"
        >
          <Plus size={24} className={`absolute transition-all duration-300 ${dialOpen ? 'opacity-0 rotate-45' : 'opacity-100 rotate-0'}`} />
          <X size={24} className={`absolute transition-all duration-300 ${dialOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-45'}`} />
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
