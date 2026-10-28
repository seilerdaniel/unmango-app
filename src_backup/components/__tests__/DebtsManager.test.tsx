import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DebtsManager from '../DebtsManager'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import { loadPendingQueue } from '@/lib/offlineQueue'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function renderWithProviders() {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <DebtsManager />
      </PrivacyProvider>
    </AppProviders>
  )
}

const debtRow = {
  id: 'debt-1',
  user_id: 'user-1',
  description: 'Préstamo para el viaje',
  counterparty_name: 'Juan',
  debt_type: 'debo' as const,
  currency: 'ARS' as const,
  total_amount: 5000,
  remaining_amount: 5000,
  interest_rate: 0,
  due_date: null,
  notes: 'acordamos pagar en 3 cuotas',
  created_at: '2026-07-01T00:00:00.000Z',
}

describe('DebtsManager — editar deuda (Tanda 9)', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    localStorage.clear()
  })

  it('abre el modal de edición con los datos de la deuda', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { debts: { data: [debtRow], error: null } },
      })
    )

    renderWithProviders()

    await userEvent.click(await screen.findByTitle('Editar'))

    expect(await screen.findByText('Editar Deuda')).toBeInTheDocument()
    const descInput = screen.getByDisplayValue('Préstamo para el viaje')
    expect(descInput).toBeInTheDocument()
    expect(screen.getByDisplayValue('Juan')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('acordamos pagar en 3 cuotas')).toBeInTheDocument()
  })

  it('guarda los cambios con update y recarga', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { debts: { data: [debtRow], error: null } },
      })
    )

    renderWithProviders()

    await userEvent.click(await screen.findByTitle('Editar'))

    const descInput = await screen.findByDisplayValue('Préstamo para el viaje')
    await userEvent.clear(descInput)
    await userEvent.type(descInput, 'Préstamo auto')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await screen.findByText('Deudas y Préstamos')

    const builders = (supabaseMock.from as ReturnType<typeof vi.fn>).mock.results.map((r) => r.value) as Array<{
      update?: ReturnType<typeof vi.fn>
    }>
    const updateFns = builders
      .filter((b) => typeof b.update === 'function')
      .map((b) => b.update as ReturnType<typeof vi.fn>)
    expect(updateFns.some((fn) => fn.mock.calls.length > 0)).toBe(true)
  })

  it('en modo offline encole el update con el id de la deuda', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { debts: { data: [debtRow], error: null } },
      })
    )
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    renderWithProviders()

    await userEvent.click(await screen.findByTitle('Editar'))

    const montoInput = await screen.findByDisplayValue('5000')
    await userEvent.clear(montoInput)
    await userEvent.type(montoInput, '8000')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByText(/Sin conexión: guardado en tu celular/i)).toBeInTheDocument()

    const queue = loadPendingQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ entity: 'debts', operation: 'update' })
    expect(queue[0].payload).toMatchObject({ id: 'debt-1', total_amount: 8000, remaining_amount: 8000 })
  })
})
