import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionFilters from '../TransactionFilters'
import { CategoriesProvider } from '@/context/CategoriesContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'
import type { Transaction } from '@/types'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    category_id: null,
    description: 'Compra genérica',
    type: 'expense',
    payment_method: 'Efectivo',
    wallet_provider: null,
    operation_number: null,
    is_usd: false,
    amount_usd: null,
    amount_ars: 1000,
    exchange_rate: null,
    created_at: '2026-07-01T00:00:00.000Z',
    categories: null,
    ...overrides,
  } as Transaction
}

const TRANSACTIONS: Transaction[] = [
  makeTx({ id: 'tx-1', type: 'expense', description: 'Supermercado', amount_ars: 5000 }),
  makeTx({ id: 'tx-2', type: 'income', description: 'Sueldo', amount_ars: 100000 }),
]

describe('TransactionFilters — exportar CSV (regresión Fase 2)', () => {
  beforeEach(() => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({ tableResults: { categories: { data: [], error: null } } })
    )
  })

  it('exporta solo las transacciones visibles/filtradas, no todas', async () => {
    const clickSpy = vi.fn()
    const anchors: HTMLAnchorElement[] = []
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        const el = realCreateElement(tagName)
        if (tagName === 'a') {
          el.click = clickSpy
          anchors.push(el as HTMLAnchorElement)
        }
        return el
      })

    render(
      <CategoriesProvider>
        <TransactionFilters transactions={TRANSACTIONS} onFiltered={() => {}} />
      </CategoriesProvider>
    )

    // Filtramos para dejar solo ingresos (1 de las 2 transacciones)
    const typeSelect = await screen.findByDisplayValue('Todos los Tipos')
    await userEvent.selectOptions(typeSelect, 'Solo Ingresos')

    const exportButton = screen.getByRole('button', { name: /exportar csv/i })
    await userEvent.click(exportButton)

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(anchors.length).toBeGreaterThan(0)

    // El href es un data URI con el CSV embebido: si el bug volviera
    // (exportar "transactions" completo en vez del filtrado), el CSV
    // incluiría "Supermercado" (un gasto) aunque el filtro esté en
    // "Solo Ingresos".
    const hrefUsed = anchors[anchors.length - 1].getAttribute('href')
    expect(hrefUsed).toBeTruthy()
    const decoded = decodeURIComponent(hrefUsed!)
    expect(decoded).toContain('Sueldo')
    expect(decoded).not.toContain('Supermercado')

    createElementSpy.mockRestore()
  })
})
