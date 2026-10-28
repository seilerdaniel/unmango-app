import { describe, it, expect } from 'vitest'
import { sortRecurringExpenses, filterRecurringByKind } from '../recurringSort'
import { RecurringExpense } from '@/types'

function makeItem(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: '1',
    user_id: 'u1',
    category_id: null,
    title: 'Test',
    amount: 1000,
    currency: 'ARS',
    billing_day: 10,
    is_active: true,
    created_at: '',
    payment_method: null,
    membership_type: null,
    tax_percentage: 0,
    wallet_id: null,
    expense_kind: 'subscription',
    billing_frequency: 'monthly',
    billing_month: null,
    ...overrides,
  } as RecurringExpense
}

const ITEMS = [
  makeItem({ id: '1', title: 'Netflix', amount: 5000, expense_kind: 'subscription' }),
  makeItem({ id: '2', title: 'Alquiler', amount: 200000, expense_kind: 'utility_rent' }),
  makeItem({ id: '3', title: 'Agua', amount: 3000, expense_kind: 'utility_rent' }),
]

describe('sortRecurringExpenses', () => {
  it('ordena por nombre A-Z', () => {
    const result = sortRecurringExpenses(ITEMS, 'name', true)
    expect(result.map((i) => i.title)).toEqual(['Agua', 'Alquiler', 'Netflix'])
  })

  it('ordena por monto de mayor a menor', () => {
    const result = sortRecurringExpenses(ITEMS, 'amount', false)
    expect(result.map((i) => i.amount)).toEqual([200000, 5000, 3000])
  })

  it('no muta el array original', () => {
    const original = [...ITEMS]
    sortRecurringExpenses(ITEMS, 'name', true)
    expect(ITEMS).toEqual(original)
  })
})

describe('filterRecurringByKind', () => {
  it('filtra por tipo', () => {
    const result = filterRecurringByKind(ITEMS, 'utility_rent')
    expect(result).toHaveLength(2)
  })

  it('devuelve todo con "all"', () => {
    expect(filterRecurringByKind(ITEMS, 'all')).toHaveLength(3)
  })
})
