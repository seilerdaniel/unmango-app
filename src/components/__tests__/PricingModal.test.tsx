import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PricingModal from '../PricingModal'
import { ToastProvider } from '@/context/ToastContext'

function renderModal(overrides: Partial<React.ComponentProps<typeof PricingModal>> = {}) {
  return render(
    <ToastProvider>
      <PricingModal isOpen currentPlan="free" onClose={() => {}} {...overrides} />
    </ToastProvider>
  )
}

describe('PricingModal', () => {
  it('no renderiza nada cuando está cerrado', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('heading', { name: /Planes UnMango/i })).not.toBeInTheDocument()
  })

  it('muestra las tres tarjetas de plan', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /Planes UnMango/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FREE' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PRO' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'HOGAR' })).toBeInTheDocument()
    expect(screen.getByText('$9.99')).toBeInTheDocument()
    expect(screen.getByText('$29.99')).toBeInTheDocument()
  })

  it('marca la tarjeta PRO como la popular', () => {
    renderModal()
    expect(screen.getByText('Popular')).toBeInTheDocument()
  })

  it('marca el plan actual con el badge "Actual"', () => {
    renderModal({ currentPlan: 'pro' })
    expect(screen.getAllByText('Actual')).toHaveLength(1)
  })

  it('elegir otro plan avisa que el pago online llega en una próxima tanda', async () => {
    renderModal({ currentPlan: 'free' })
    await userEvent.click(screen.getByRole('button', { name: /elegir pro/i }))
    expect(await screen.findByText(/próxima tanda/i)).toBeInTheDocument()
  })

  it('el botón del plan actual está deshabilitado', () => {
    renderModal({ currentPlan: 'free' })
    expect(screen.getByRole('button', { name: /tu plan actual/i })).toBeDisabled()
  })

  it('cierra con el botón X', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    await userEvent.click(screen.getByTitle('Cerrar'))
    expect(onClose).toHaveBeenCalled()
  })
})
