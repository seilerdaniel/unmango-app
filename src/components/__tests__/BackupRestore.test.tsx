import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackupRestore from '../BackupRestore'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function makePayload(transactions: number, categories = 2) {
  return {
    version: 1,
    exported_at: '2026-07-31T00:00:00.000Z',
    categories: Array.from({ length: categories }, (_, i) => ({
      id: `cat-${i}`,
      name: `Categoría ${i}`,
    })),
    wallets: [],
    budgets: [],
    recurring_expenses: [],
    savings_goals: [],
    transactions: Array.from({ length: transactions }, (_, i) => ({
      id: `tx-${i}`,
      description: `Gasto ${i}`,
      amount_ars: 100,
      type: 'expense',
      payment_method: 'Efectivo',
      is_usd: false,
    })),
  }
}

async function restoreFile(container: HTMLElement, payload: unknown) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })
  await userEvent.upload(input, file)
}

describe('BackupRestore', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('restaura en lotes (chunks) y muestra el resumen de lo insertado', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          wallets: { data: [], error: null },
          transactions: { data: [], error: null },
          budgets: { data: [], error: null },
          recurring_expenses: { data: [], error: null },
          savings_goals: { data: [], error: null },
        },
      })
    )

    const { container } = render(<BackupRestore />)
    await restoreFile(container, makePayload(250))

    // Espera a que el restore termine (el resumen aparece al final) antes
    // de inspeccionar cuántas queries se hicieron.
    await waitFor(() =>
      expect(
        screen.getByText(
          /Restaurado: 2 categories, 0 wallets, 250 transactions, 0 budgets, 0 recurring_expenses, 0 savings_goals/
        )
      ).toBeInTheDocument()
    )

    // 250 movimientos + 2 categorías → 3 lotes de transacciones (100+100+50) + 1 de categorías.
    const txQueries = supabaseMock._fromCalls.filter((t) => t === 'transactions')
    const catQueries = supabaseMock._fromCalls.filter((t) => t === 'categories')
    expect(txQueries).toHaveLength(3)
    expect(catQueries).toHaveLength(1)
  })

  it('si un lote falla, notifica cuántos entraron y el primer error', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          wallets: { data: [], error: null },
          transactions: { data: [], error: { message: 'boom de lote' } },
          budgets: { data: [], error: null },
          recurring_expenses: { data: [], error: null },
          savings_goals: { data: [], error: null },
        },
      })
    )

    const { container } = render(<BackupRestore />)
    await restoreFile(container, makePayload(10))

    await waitFor(() =>
      expect(screen.getByText(/no se pudieron insertar/)).toBeInTheDocument()
    )
    expect(screen.getByText(/primer error: boom de lote/)).toBeInTheDocument()
    // las categorías sí entraron, los movimientos no
    expect(screen.getByText(/Se insertaron 2 de 12 registros/)).toBeInTheDocument()
  })
})
