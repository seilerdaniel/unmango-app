import { describe, it, expect } from 'vitest'
import { computeHouseholdSettlement, HOUSEHOLD_DEBTOR_DESCRIPTION, HOUSEHOLD_CREDITOR_DESCRIPTION } from '../householdSettlement'

describe('computeHouseholdSettlement', () => {
  it('si están a mano, no hay nada que transferir y no hay dirección', () => {
    const result = computeHouseholdSettlement(50000, 50000)
    expect(result.amount).toBe(0)
    expect(result.iOwe).toBe(false)
    expect(result.iAmOwed).toBe(false)
  })

  it('sin gastos cargados: monto 0 y sin dirección', () => {
    const result = computeHouseholdSettlement(0, 0)
    expect(result.amount).toBe(0)
    expect(result.iOwe).toBe(false)
    expect(result.iAmOwed).toBe(false)
  })

  it('si pagué menos de la mitad, yo le debo la diferencia a la pareja', () => {
    const result = computeHouseholdSettlement(30000, 70000)
    expect(result.amount).toBe(20000)
    expect(result.iOwe).toBe(true)
    expect(result.iAmOwed).toBe(false)
  })

  it('si pagué más de la mitad, la pareja me debe la diferencia a mí', () => {
    const result = computeHouseholdSettlement(70000, 30000)
    expect(result.amount).toBe(20000)
    expect(result.iOwe).toBe(false)
    expect(result.iAmOwed).toBe(true)
  })

  it('si la pareja no aportó nada, me debe la mitad de lo que puse', () => {
    const result = computeHouseholdSettlement(100000, 0)
    expect(result.amount).toBe(50000)
    expect(result.iAmOwed).toBe(true)
  })

  it('si yo no aporté nada, le debo la mitad de lo que puso la pareja', () => {
    const result = computeHouseholdSettlement(0, 100000)
    expect(result.amount).toBe(50000)
    expect(result.iOwe).toBe(true)
  })

  it('mantiene la consistencia entre balance y liquidación en montos impares', () => {
    const result = computeHouseholdSettlement(45001, 44999)
    expect(result.amount).toBe(1)
    expect(result.iAmOwed).toBe(true)
  })

  it('el monto de liquidación es el mismo sin importar quién pague más (solo cambia la dirección)', () => {
    expect(computeHouseholdSettlement(70000, 30000).amount).toBe(20000)
    expect(computeHouseholdSettlement(30000, 70000).amount).toBe(20000)
  })

  it('expone descripciones estables para los movimientos de deudor y acreedor', () => {
    const result = computeHouseholdSettlement(100000, 0)
    expect(result.debtorDescription).toBe(HOUSEHOLD_DEBTOR_DESCRIPTION)
    expect(result.creditorDescription).toBe(HOUSEHOLD_CREDITOR_DESCRIPTION)
  })
})
