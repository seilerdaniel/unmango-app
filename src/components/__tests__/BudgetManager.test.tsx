import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BudgetManager from '../BudgetManager'
import { CategoriesProvider } from '@/context/CategoriesContext'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const BUDGET_ROW = {
  id: 'budget-1',
  user_id: 'user-1',
  category_id: 'cat-1',
  monthly_limit: 10000,
  created_at: '2026-07-01T00:00:00.000Z',
  categories: { name: 'Comida', color: '#f59e0b' },
}

function renderWithProviders() {
  return render(
    <PrivacyProvider>
      <CategoriesProvider>
        <BudgetManager />
      </CategoriesProvider>
    </PrivacyProvider>
  )
}

describe('BudgetManager', () => {
  it('marca el presupuesto como "Excedido" cuando el gasto RPC supera el límite', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          budgets: { data: [BUDGET_ROW], error: null },
        },
        // get_monthly_category_spend viene de Postgres (Fase 3): el gasto
        // ya NO se calcula sumando un array de transacciones en el
        // frontend.
        rpcResults: {
          get_monthly_category_spend: {
            data: [{ category_id: 'cat-1', spent: 12000 }],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    expect(await screen.findByText('Excedido')).toBeInTheDocument()
    expect(screen.getByText(/Gastado:/)).toHaveTextContent('12.000,00')
  })

  it('no marca "Excedido" cuando el gasto está por debajo del límite', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          budgets: { data: [BUDGET_ROW], error: null },
        },
        rpcResults: {
          get_monthly_category_spend: {
            data: [{ category_id: 'cat-1', spent: 3000 }],
            error: null,
          },
        },
      })
    )

    renderWithProviders()

    await screen.findByText('Comida')
    expect(screen.queryByText('Excedido')).not.toBeInTheDocument()
  })
})
