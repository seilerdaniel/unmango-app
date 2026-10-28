'use client'

import { useEffect } from 'react'

/**
 * Decide si un evento de teclado debería ignorarse porque el foco ya
 * está en un campo de formulario (para no interceptar "n", "p" o "/"
 * mientras el usuario está escribiendo texto normal). Separado como
 * función pura para poder testearlo sin simular el DOM completo.
 */
export function shouldIgnoreShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    !!target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true'
  )
}

interface ShortcutHandlers {
  onNewTransaction: () => void
  onTogglePrivacy: () => void
  onFocusSearch: () => void
}

/**
 * Atajos globales del dashboard:
 * - N: foco en el campo de descripción del formulario de carga rápida
 * - P: alternar Modo Privado
 * - /: foco en el buscador del historial
 */
export function useKeyboardShortcuts({
  onNewTransaction,
  onTogglePrivacy,
  onFocusSearch,
}: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (shouldIgnoreShortcut(e.target)) return

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          onNewTransaction()
          break
        case 'p':
          e.preventDefault()
          onTogglePrivacy()
          break
        case '/':
          e.preventDefault()
          onFocusSearch()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNewTransaction, onTogglePrivacy, onFocusSearch])
}
