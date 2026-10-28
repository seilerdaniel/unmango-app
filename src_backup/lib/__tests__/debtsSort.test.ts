import { describe, it, expect } from 'vitest'
import { sortDebts, filterDebtsByType } from '../debtsSort'
import { Debt } from '@/types'

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: '1',
    user_id: 'u1',
    description: 'Test',
    counterparty_name: 'Alguien',
    debt_type: 'debo',
    currency: 'ARS',
    total_amount: 1000,
    remaining_amount: 1000,
    interest_rate: 0,
    due_date: null,
    notes: null,
    created_at: '',
    ...overrides,
  } as Debt
}

const DEBTS = [
  makeDebt({ id: '1', description: 'Préstamo auto', remaining_amount: 500000, due_date: '2026-08-15', debt_type: 'debo' }),
  makeDebt({ id: '2', description: 'Cena viernes', remaining_amount: 3000, due_date: null, debt_type: 'me_deben' }),
  makeDebt({ id: '3', description: 'Alquiler compartido', remaining_amount: 50000, due_date: '2026-08-01', debt_type: 'debo' }),
]

describe('sortDebts', () => {
  it('ordena por nombre A-Z', () => {
    const result = sortDebts(DEBTS, 'name', true)
    expect(result.map((d) => d.description)).toEqual(['Alquiler compartido', 'Cena viernes', 'Préstamo auto'])
  })

  it('ordena por monto restante de mayor a menor', () => {
    const result = sortDebts(DEBTS, 'amount', false)
    expect(result.map((d) => d.remaining_amount)).toEqual([500000, 50000, 3000])
  })

  it('ordena por vencimiento, las sin fecha siempre al final', () => {
    const result = sortDebts(DEBTS, 'dueDate', true)
    expect(result.map((d) => d.description)).toEqual(['Alquiler compartido', 'Préstamo auto', 'Cena viernes'])
  })

  it('las sin fecha quedan al final tambien invirtiendo el orden', () => {
    const result = sortDebts(DEBTS, 'dueDate', false)
    expect(result[result.length - 1].description).toBe('Cena viernes')
  })
})

describe('filterDebtsByType', () => {
  it('filtra por tipo', () => {
    expect(filterDebtsByType(DEBTS, 'debo')).toHaveLength(2)
    expect(filterDebtsByType(DEBTS, 'me_deben')).toHaveLength(1)
  })

  it('devuelve todo con "all"', () => {
    expect(filterDebtsByType(DEBTS, 'all')).toHaveLength(3)
  })
})
