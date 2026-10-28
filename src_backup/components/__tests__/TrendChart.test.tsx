import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrendChart from '../TrendChart'
import { ThemeProvider } from '@/context/ThemeContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function renderWithProviders() {
  return render(
    <ThemeProvider>
      <TrendChart />
    </ThemeProvider>
  )
}

describe('TrendChart', () => {
  it('pide la tendencia de los últimos 6 meses vía RPC', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        rpcResults: {
          get_monthly_trend: {
            data: [{ month_start: '2026-07-01', total_income: 100000, total_expense: 50000 }],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    await screen.findByText(/Tendencia — últimos 6 meses/i)
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_monthly_trend', { p_months: 6 })
  })

  it('muestra un mensaje cuando no hay datos suficientes', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({ rpcResults: { get_monthly_trend: { data: [], error: null } } })
    )

    renderWithProviders()

    expect(await screen.findByText(/no hay suficientes movimientos/i)).toBeInTheDocument()
  })
})
