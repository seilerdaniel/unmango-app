import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoundUpSavingsCard from '../RoundUpSavingsCard'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { DashboardDataProvider } from '@/context/DashboardDataContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function renderWithProviders() {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <DashboardDataProvider>
          <RoundUpSavingsCard />
        </DashboardDataProvider>
      </PrivacyProvider>
    </AppProviders>
  )
}

/** Último builder devuelto por `from(table)`, que es el de la última operación. */
function lastFromBuilder(table: string) {
  const results = supabaseMock.from.mock.results
  const calls = supabaseMock.from.mock.calls.map((args, i) => ({ table: args[0], builder: results[i].value }))
  const matches = calls.filter((c) => c.table === table)
  return matches[matches.length - 1].builder
}

const GOAL = {
  id: 'goal-1',
  user_id: 'user-1',
  name: 'Vacaciones',
  target_amount: 100000,
  current_amount: 0,
  monthly_contribution: 0,
  monthly_interest_rate: 0,
  color: '#10b981',
  created_at: '2026-07-01T00:00:00.000Z',
}

describe('RoundUpSavingsCard — total del mes', () => {
  it('muestra el acumulado redondeando los gastos del mes', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          roundup_savings: { data: { roundup_enabled: true, roundup_step: 1000 }, error: null },
          savings_goals: { data: [GOAL], error: null },
          transactions: {
            data: [
              { description: 'café', amount_ars: 3200, created_at: '2026-08-02T00:00:00.000Z' },
              { description: 'bondi', amount_ars: 1500, created_at: '2026-08-02T00:00:00.000Z' },
              { description: 'alquiler', amount_ars: 4000, created_at: '2026-08-02T00:00:00.000Z' },
            ],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    expect((await screen.findAllByText(/\$\s*1\.300/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Este mes acumulaste/i)).toBeInTheDocument()
  })

  it('muestra el mensaje de desactivado cuando el ahorro está apagado', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          roundup_savings: { data: { roundup_enabled: false, roundup_step: 500 }, error: null },
          savings_goals: { data: [GOAL], error: null },
        },
      })
    )

    renderWithProviders()

    expect(await screen.findByText(/Activá el ahorro por redondeo/i)).toBeInTheDocument()
    expect(screen.queryByText(/Este mes acumulaste/i)).not.toBeInTheDocument()
  })
})

describe('RoundUpSavingsCard — configuración', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('persiste el toggle y el paso elegido en roundup_savings', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          roundup_savings: { data: { roundup_enabled: true, roundup_step: 1000 }, error: null },
          savings_goals: { data: [GOAL], error: null },
        },
      })
    )

    renderWithProviders()

    const switchButton = await screen.findByRole('switch')
    await userEvent.click(switchButton)

    await waitFor(() => {
      expect(lastFromBuilder('roundup_savings').upsert).toHaveBeenCalledWith(
        expect.objectContaining({ roundup_enabled: false, roundup_step: 1000 }),
        { onConflict: 'user_id' }
      )
    })
  })
})

describe('RoundUpSavingsCard — derivar a una meta', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('suma el total del bolsillo al current_amount de la meta elegida', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          roundup_savings: { data: { roundup_enabled: true, roundup_step: 1000 }, error: null },
          savings_goals: { data: [{ ...GOAL, current_amount: 2000 }], error: null },
          transactions: {
            data: [
              { description: 'café', amount_ars: 3200, created_at: '2026-08-02T00:00:00.000Z' },
              { description: 'bondi', amount_ars: 1500, created_at: '2026-08-02T00:00:00.000Z' },
            ],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    await userEvent.click(await screen.findByRole('button', { name: /Derivar.*1\.300/ }))

    await waitFor(() => {
      expect(lastFromBuilder('savings_goals').update).toHaveBeenCalledWith({ current_amount: 3300 })
      expect(lastFromBuilder('savings_goals').eq).toHaveBeenCalledWith('id', 'goal-1')
    })
  })
})
