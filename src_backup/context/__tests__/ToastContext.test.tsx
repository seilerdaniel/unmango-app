import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { ToastProvider, useToast } from '../ToastContext'

function renderToast() {
  return renderHook(() => useToast(), { wrapper: ToastProvider })
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('useToast tira error fuera del provider', () => {
    expect(() => renderHook(() => useToast())).toThrow('useToast debe ser usado dentro de un ToastProvider')
  })

  it('agrega un toast y lo muestra con su mensaje', () => {
    const { result } = renderToast()
    act(() => {
      result.current.toast.success('Movimiento guardado.')
    })
    expect(screen.getByText('Movimiento guardado.')).toBeInTheDocument()
  })

  it('auto-descarta el toast después de 4 segundos', () => {
    const { result } = renderToast()
    act(() => {
      result.current.toast.error('Algo salió mal.')
    })
    expect(screen.getByText('Algo salió mal.')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Algo salió mal.')).not.toBeInTheDocument()
  })

  it('descarta manualmente el toast con su botón de cierre', () => {
    const { result } = renderToast()
    act(() => {
      result.current.toast.warning('Cuidado.')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar notificación' }))
    expect(screen.queryByText('Cuidado.')).not.toBeInTheDocument()
  })

  it('muestra varios toasts a la vez', () => {
    const { result } = renderToast()
    act(() => {
      result.current.toast.success('Uno.')
      result.current.toast.info('Dos.')
    })
    expect(screen.getByText('Uno.')).toBeInTheDocument()
    expect(screen.getByText('Dos.')).toBeInTheDocument()
  })

  it('confirmDialog resuelve true al confirmar', async () => {
    const { result } = renderToast()
    let resolved: boolean | undefined
    act(() => {
      resolved = undefined
      result.current.confirmDialog({ title: '¿Seguro?', message: 'Esto borra datos.' }).then((v) => (resolved = v))
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await act(async () => {})
    expect(resolved).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirmDialog resuelve false al cancelar', async () => {
    const { result } = renderToast()
    let resolved: boolean | undefined
    act(() => {
      result.current.confirmDialog({ title: '¿Seguro?', message: 'Esto borra datos.' }).then((v) => (resolved = v))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await act(async () => {})
    expect(resolved).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
