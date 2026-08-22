import { describe, it, expect } from 'vitest'
import { simulateInstallmentPurchase } from '../installmentSimulator'

describe('simulateInstallmentPurchase', () => {
  it('cuotas sin interés con inflación alta → BUY_INSTALLMENTS', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 10000,
      installmentCount: 12,
      monthlyInflationRate: 8,
    })

    expect(result.verdict).toBe('BUY_INSTALLMENTS')
    expect(result.totalInstallmentPrice).toBe(120000)
    expect(result.nominalSurchargePercent).toBe(20)
    expect(result.presentValueFinanced).toBeLessThan(result.cashPrice)
    expect(result.realSurcharge).toBeLessThan(0)
  })

  it('recargo desproporcionado con inflación baja → BUY_CASH', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 25000,
      installmentCount: 12,
      monthlyInflationRate: 2,
    })

    expect(result.verdict).toBe('BUY_CASH')
    expect(result.presentValueFinanced).toBeGreaterThan(result.cashPrice)
    expect(result.realSurcharge).toBeGreaterThan(0)
  })

  it('desglosa el valor presente mes a mes con redondeo correcto', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 10000,
      installmentCount: 12,
      monthlyInflationRate: 8,
    })

    expect(result.monthlyBreakdown).toHaveLength(12)
    expect(result.monthlyBreakdown[0].presentValue).toBeCloseTo(9259.26, 2)
    expect(result.monthlyBreakdown[11].presentValue).toBeLessThan(result.monthlyBreakdown[0].presentValue)
    expect(result.monthlyBreakdown[11].cumulativePresentValue).toBeCloseTo(result.presentValueFinanced, 2)

    const sumOfPresentValues = result.monthlyBreakdown.reduce((acc, row) => acc + row.presentValue, 0)
    expect(sumOfPresentValues).toBeCloseTo(result.presentValueFinanced, 2)
  })

  it('cuando el costo real iguala al contado → EQUIVALENT', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      totalInstallmentPrice: 100000,
      installmentCount: 1,
      monthlyInflationRate: 0,
    })

    expect(result.verdict).toBe('EQUIVALENT')
    expect(result.presentValueFinanced).toBe(100000)
    expect(result.realSurcharge).toBe(0)
  })

  it('deriva el monto de cuota cuando se provee totalInstallmentPrice', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 90000,
      totalInstallmentPrice: 120000,
      installmentCount: 12,
      monthlyInflationRate: 5,
    })

    expect(result.installmentAmount).toBe(10000)
    expect(result.totalInstallmentPrice).toBe(120000)
  })

  it('una TNA de inversión eleva el descuento y baja el valor presente', () => {
    const base = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 10000,
      installmentCount: 12,
      monthlyInflationRate: 5,
    })
    const withTna = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 10000,
      installmentCount: 12,
      monthlyInflationRate: 5,
      investmentTna: 36,
    })

    expect(withTna.presentValueFinanced).toBeLessThan(base.presentValueFinanced)
    expect(withTna.monthlyDiscountRate).toBeGreaterThan(base.monthlyDiscountRate)
  })

  it('sin inflación ni TNA, financiar siempre vale más que el contado (nominal)', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 10000,
      installmentCount: 12,
      monthlyInflationRate: 0,
    })

    expect(result.presentValueFinanced).toBeCloseTo(120000)
    expect(result.verdict).toBe('BUY_CASH')
  })

  it('maneja una sola cuota igual al contado con inflación → BUY_INSTALLMENTS', () => {
    const result = simulateInstallmentPurchase({
      cashPrice: 100000,
      installmentAmount: 100000,
      installmentCount: 1,
      monthlyInflationRate: 10,
    })

    expect(result.verdict).toBe('BUY_INSTALLMENTS')
    expect(result.monthlyBreakdown[0].presentValue).toBeCloseTo(90909.09, 2)
  })
})
