import { describe, it, expect } from 'vitest'
import { daysUntilNextBilling, monthlyEquivalentAmount } from '../recurringBilling'

describe('daysUntilNextBilling — mensual', () => {
  it('calcula los días restantes dentro del mismo mes', () => {
    const today = new Date(2026, 6, 10) // 10 de julio
    expect(daysUntilNextBilling(15, 'monthly', null, today)).toBe(5)
  })

  it('salta al mes siguiente si el día ya pasó', () => {
    const today = new Date(2026, 6, 20)
    // Del 20 de julio al 5 de agosto: 11 + 5 = 16 días
    expect(daysUntilNextBilling(5, 'monthly', null, today)).toBe(16)
  })

  it('clampea al último día del mes si no existe (31 en febrero)', () => {
    const today = new Date(2026, 1, 20) // 20 feb 2026 (28 días)
    expect(daysUntilNextBilling(31, 'monthly', null, today)).toBe(8)
  })
})

describe('daysUntilNextBilling — anual', () => {
  it('calcula los días hasta el mes/día de facturación este año', () => {
    const today = new Date(2026, 0, 1) // 1 de enero
    // Factura el 15 de marzo (mes 3)
    const days = daysUntilNextBilling(15, 'annual', 3, today)
    const expected = Math.round((new Date(2026, 2, 15).getTime() - today.getTime()) / 86400000)
    expect(days).toBe(expected)
  })

  it('salta al año siguiente si ya pasó la fecha de facturación este año', () => {
    const today = new Date(2026, 6, 1) // 1 de julio
    // Factura el 15 de marzo (mes 3) -> ya pasó, va a marzo 2027
    const days = daysUntilNextBilling(15, 'annual', 3, today)
    const expected = Math.round((new Date(2027, 2, 15).getTime() - today.getTime()) / 86400000)
    expect(days).toBe(expected)
  })

  it('si no hay billingMonth, se comporta como mensual (fallback seguro)', () => {
    const today = new Date(2026, 6, 10)
    expect(daysUntilNextBilling(15, 'annual', null, today)).toBe(5)
  })
})

describe('monthlyEquivalentAmount', () => {
  it('un gasto mensual no cambia', () => {
    expect(monthlyEquivalentAmount(10000, 'monthly')).toBe(10000)
  })

  it('un gasto anual se prorratea dividiendo por 12', () => {
    expect(monthlyEquivalentAmount(120000, 'annual')).toBe(10000)
  })
})
