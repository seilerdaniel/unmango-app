'use client'

import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Configuración vive fuera de las 4 pestañas principales — se abre
 * desde el ícono del header, como pide el rediseño ("mover Ajustes a
 * un ícono en la barra superior"). Es un overlay a pantalla completa,
 * no una pestaña más del bottom nav.
 */
export default function SettingsPanel({ isOpen, onClose, children }: SettingsPanelProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 px-4 sm:px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Configuración</h1>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition cursor-pointer"
          title="Cerrar"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">{children}</div>
    </div>
  )
}
