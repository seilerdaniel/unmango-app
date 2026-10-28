import { describe, it, expect } from 'vitest'
import { compareInstallmentsVsCash } from '../installmentsVsCash'

describe('compareInstallmentsVsCash', () => {
  it('con inflación alta y cuotas sin interés, conviene financiar (cuotas)', () => {
    const result = compareInstallmentsVsCash(100000, 10000, 12, 8)
    expect(result.recommendation).toBe('cuotas')
    expect(result.savingsAmount).toBeGreaterThan(0)
  })

  it('sin inflación, financiar más caro que el contado nunca conviene', () => {
    const result = compareInstallmentsVsCash(100000, 10000, 12, 0)
    expect(result.presentValueFinanced).toBeCloseTo(120000)
    expect(result.recommendation).toBe('contado')
  })

  it('calcula el total financiado nominal (sin descuento)', () => {
    const result = compareInstallmentsVsCash(50000, 5000, 10, 5)
    expect(result.totalFinanced).toBe(50000)
  })

  it('si el valor presente financiado es igual al contado, no hay ahorro', () => {
    const result = compareInstallmentsVsCash(100000, 10000, 12, 0)
    expect(result.savingsAmount).toBeLessThan(0)
  })
})
