'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'

interface PopoverPickerProps {
  trigger: ReactNode
  children: ReactNode
  label?: string
}

/**
 * Botón que al tocarlo abre un panel flotante con lo que sea
 * (`children`) — se usa para meter el selector de íconos y el de
 * colores dentro de un menú compacto en vez de tenerlos sueltos
 * ocupando espacio todo el tiempo.
 */
export default function PopoverPicker({ trigger, children, label }: PopoverPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={label}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
      >
        {trigger}
      </button>

      {open && (
        <div
          className="absolute z-30 right-0 mt-2 p-2.5 min-w-[224px] max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg"
          onClick={(e) => {
            // Si lo que está adentro es un botón de selección (no el
            // color picker nativo, que necesita quedar abierto), cerramos
            // el panel al elegir algo.
            const target = e.target as HTMLElement
            if (target.tagName === 'BUTTON') setOpen(false)
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
