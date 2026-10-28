'use client'

import { Home, PieChart, Target, List } from 'lucide-react'

export type TabId = 'inicio' | 'analisis' | 'planes' | 'historial'

interface BottomNavProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'analisis', label: 'Análisis', icon: PieChart },
  { id: 'planes', label: 'Planes', icon: Target },
  { id: 'historial', label: 'Historial', icon: List },
]

/**
 * Navegación inferior fija, estilo app mobile. Deja un espacio libre en
 * el medio (col-span vacío) para el FAB central que se suma en el
 * siguiente paso — por ahora son 4 pestañas repartidas en los 4
 * costados, con el hueco del medio ya reservado para no tener que
 * reacomodar todo cuando se agregue.
 */
export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const [firstHalf, secondHalf] = [TABS.slice(0, 2), TABS.slice(2)]

  function renderTab(tab: (typeof TABS)[number]) {
    const Icon = tab.icon
    const isActive = activeTab === tab.id
    return (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition cursor-pointer ${
          isActive ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
      </button>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {firstHalf.map(renderTab)}
      {/* Hueco reservado para el FAB central desplegable (próximo paso) */}
      <div className="w-16 shrink-0" />
      {secondHalf.map(renderTab)}
    </nav>
  )
}
