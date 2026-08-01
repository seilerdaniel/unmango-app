import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SavingsGoals from '../SavingsGoals'
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
        <SavingsGoals />
      </PrivacyProvider>
    </AppProviders>
  )
}

describe('SavingsGoals — proyección de meses', () => {
  it('calcula los meses correctos sin interés (aporte constante)', async () => {
    // Objetivo 12000, ya tiene 0, aporta 1000/mes sin interés → 12 meses.
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          savings_goals: {
            data: [
              {
                id: 'goal-1',
                user_id: 'user-1',
                name: 'Vacaciones',
                target_amount: 12000,
                current_amount: 0,
                monthly_contribution: 1000,
                monthly_interest_rate: 0,
                color: '#10b981',
                created_at: '2026-07-01T00:00:00.000Z',
              },
            ],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    expect(await screen.findByText(/la alcanzás en 12 meses/i)).toBeInTheDocument()
  })

  it('muestra "Meta alcanzada" cuando el ahorro actual ya llegó al objetivo', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          savings_goals: {
            data: [
              {
                id: 'goal-2',
                user_id: 'user-1',
                name: 'Fondo de emergencia',
                target_amount: 5000,
                current_amount: 6000,
                monthly_contribution: 0,
                monthly_interest_rate: 0,
                color: '#10b981',
                created_at: '2026-07-01T00:00:00.000Z',
              },
            ],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    expect(await screen.findByText(/meta alcanzada/i)).toBeInTheDocument()
  })
})

describe('SavingsGoals — modo offline (Tanda 3)', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    localStorage.clear()
  })

  it('crear una meta sin conexión la guarda en la cola y muestra el toast', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { savings_goals: { data: [], error: null } },
      })
    )
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    renderWithProviders()

    await userEvent.type(await screen.findByPlaceholderText('Nombre de la meta'), 'Vacaciones')
    await userEvent.type(screen.getByPlaceholderText('Objetivo ($)'), '100000')
    await userEvent.click(screen.getByRole('button', { name: /crear meta/i }))

    expect(await screen.findByText(/Sin conexión: guardado en tu celular/i)).toBeInTheDocument()

    const queue = loadPendingQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ entity: 'savings_goals', operation: 'insert' })
    expect(queue[0].payload).toMatchObject({ name: 'Vacaciones', target_amount: 100000, user_id: 'user-1' })
  })
})
