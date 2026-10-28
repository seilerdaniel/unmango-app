import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from '../ConfirmDialog'

const baseProps = {
  open: true,
  title: '¿Eliminar?',
  message: 'Esto borra el movimiento.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando open es false', () => {
    render(<ConfirmDialog {...baseProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra título, mensaje y botones con texto por defecto', () => {
    render(<ConfirmDialog {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('¿Eliminar?')).toBeInTheDocument()
    expect(screen.getByText('Esto borra el movimiento.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('usa los textos y variante customizados', () => {
    render(<ConfirmDialog {...baseProps} confirmText="Borrar" cancelText="Volver" variant="danger" />)
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(document.querySelector('[aria-modal="true"]')).toBeInTheDocument()
  })

  it('confirma al hacer click en el botón de confirmar', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(baseProps.onCancel).not.toHaveBeenCalled()
  })

  it('cancela al hacer click en cancelar', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancela al apretar Escape', async () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('confirma al apretar Enter', async () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />)
    await userEvent.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancela al hacer click en el overlay', async () => {
    const onCancel = vi.fn()
    const { container } = render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    const overlay = container.firstChild as HTMLElement
    await userEvent.click(overlay)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('re-enfoca el elemento que abrió el diálogo al cerrarse', async () => {
    const onCancel = vi.fn()
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()

    const { unmount } = render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))

    unmount()
    expect(document.activeElement).toBe(button)
    document.body.removeChild(button)
  })
})
