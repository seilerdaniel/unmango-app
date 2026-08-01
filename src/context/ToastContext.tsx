'use client'

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import ConfirmDialog, { type ConfirmVariant } from '@/components/ConfirmDialog'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  variant: ToastVariant
  message: string
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface ToastContextType {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    warning: (message: string) => void
    info: (message: string) => void
  }
  /** Reemplaza a window.confirm: resuelve true/false según la acción. */
  confirmDialog: (options: ConfirmOptions) => Promise<boolean>
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_DURATION_MS = 4000
const TOAST_STYLES: Record<ToastVariant, { container: string; icon: string }> = {
  success: {
    container: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    container: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    container: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    container: 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950',
    icon: 'text-sky-600 dark:text-sky-400',
  },
}

const TOAST_ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++nextId.current
      setToasts((prev) => [...prev, { id, variant, message }])
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    },
    [dismiss]
  )

  const toast = useMemo(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      warning: (message: string) => push('warning', message),
      info: (message: string) => push('info', message),
    }),
    [push]
  )

  const confirmDialog = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve })
      }),
    []
  )

  const handleConfirm = useCallback(() => {
    confirmState?.resolve(true)
    setConfirmState(null)
  }, [confirmState])

  const handleCancel = useCallback(() => {
    confirmState?.resolve(false)
    setConfirmState(null)
  }, [confirmState])

  return (
    <ToastContext.Provider value={{ toast, confirmDialog }}>
      {children}

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        variant={confirmState?.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 inset-x-0 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.variant]
          const Icon = TOAST_ICONS[t.variant]
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto w-full max-w-sm flex items-start gap-2.5 border rounded-xl px-3.5 py-3 shadow-lg ${style.container}`}
            >
              <Icon size={16} className={`shrink-0 mt-0.5 ${style.icon}`} />
              <p className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-relaxed flex-1">
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Descartar notificación"
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast debe ser usado dentro de un ToastProvider')
  }
  return context
}
