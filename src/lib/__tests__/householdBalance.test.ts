import { describe, it, expect } from 'vitest'
import { computeHouseholdBalance } from '../householdBalance'

describe('computeHouseholdBalance', () => {
  it('si pagaron lo mismo, el balance es 0', () => {
    const result = computeHouseholdBalance(50000, 50000)
    expect(result.netBalanceForMe).toBe(0)
  })

  it('si pagué más de la mitad, la otra persona me debe la diferencia (positivo)', () => {
    const result = computeHouseholdBalance(70000, 30000)
    expect(result.netBalanceForMe).toBe(20000)
  })

  it('si pagué menos de la mitad, yo le debo a la otra persona (negativo)', () => {
    const result = computeHouseholdBalance(30000, 70000)
    expect(result.netBalanceForMe).toBe(-20000)
  })

  it('calcula el total de gastos del hogar', () => {
    const result = computeHouseholdBalance(30000, 70000)
    expect(result.totalHouseholdExpenses).toBe(100000)
  })

  it('no rompe si todavía no hay ningún gasto cargado', () => {
    const result = computeHouseholdBalance(0, 0)
    expect(result.netBalanceForMe).toBe(0)
  })

  it('usuario solo (pareja no aportó nada): pagó todo él, la pareja le debe la mitad', () => {
    const result = computeHouseholdBalance(100000, 0)
    expect(result.netBalanceForMe).toBe(50000)
    expect(result.totalHouseholdExpenses).toBe(100000)
  })

  it('gastos desproporcionados: si el otro pagó todo, yo le debo la mitad', () => {
    const result = computeHouseholdBalance(0, 100000)
    expect(result.netBalanceForMe).toBe(-50000)
  })

  it('la diferencia exacta se reparte a la mitad con montos impares', () => {
    const result = computeHouseholdBalance(45001, 44999)
    expect(result.netBalanceForMe).toBe(1)
  })

  it('montos con centavos impares: el neto puede ser fraccionario y no rompe', () => {
    const result = computeHouseholdBalance(100000, 33333)
    expect(result.netBalanceForMe).toBe(33333.5)
  })

  it('mantiene los totales por persona incluso cuando el balance es 0', () => {
    const result = computeHouseholdBalance(0, 0)
    expect(result.totalPaidByMe).toBe(0)
    expect(result.totalPaidByPartner).toBe(0)
  })
})
