'use client'

import { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

export type ConfirmVariant = 'default' | 'danger'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Diálogo de confirmación accesible que reemplaza a `window.confirm()`.
 *
 * Accesibilidad:
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.
 * - Focus inicial en el botón Cancelar (la acción segura) y restaura el
 *   foco al elemento que abrió el diálogo al cerrarse.
 * - Esc cancela, click en el overlay cancela, Enter confirma.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const previouslyFocused = useRef<Element | null>(null)

  const restoreFocus = useCallback(() => {
    if (previouslyFocused.current instanceof HTMLElement) {
      previouslyFocused.current.focus()
    }
  }, [])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement
    cancelRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      restoreFocus()
    }
  }, [open, onCancel, onConfirm, restoreFocus])

  if (!open) return null

  const danger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {danger ? (
              <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                <AlertTriangle size={16} />
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                <Info size={16} />
              </span>
            )}
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">{message}</p>

        <div className="flex gap-2 mt-5">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-xl text-white transition-colors cursor-pointer ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
