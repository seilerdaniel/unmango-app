import { describe, it, expect } from 'vitest'
import { sortInstallmentPurchases } from '../installmentsSort'
import { InstallmentPurchase } from '@/types'

function makePurchase(overrides: Partial<InstallmentPurchase>): InstallmentPurchase {
  return {
    id: '1',
    user_id: 'u1',
    description: 'Test',
    total_amount: 1000,
    installments_count: 12,
    first_payment_date: '2026-01-01',
    payment_method: null,
    notes: null,
    created_at: '',
    ...overrides,
  } as InstallmentPurchase
}

const PURCHASES = [
  makePurchase({ id: '1', description: 'Heladera', total_amount: 500000 }),
  makePurchase({ id: '2', description: 'Auriculares', total_amount: 80000 }),
  makePurchase({ id: '3', description: 'Colchón', total_amount: 300000 }),
]

describe('sortInstallmentPurchases', () => {
  it('ordena por nombre A-Z', () => {
    const result = sortInstallmentPurchases(PURCHASES, 'name', true)
    expect(result.map((p) => p.description)).toEqual(['Auriculares', 'Colchón', 'Heladera'])
  })

  it('ordena por monto de mayor a menor', () => {
    const result = sortInstallmentPurchases(PURCHASES, 'amount', false)
    expect(result.map((p) => p.total_amount)).toEqual([500000, 300000, 80000])
  })

  it('no muta el array original', () => {
    const original = [...PURCHASES]
    sortInstallmentPurchases(PURCHASES, 'name', true)
    expect(PURCHASES).toEqual(original)
  })
})
