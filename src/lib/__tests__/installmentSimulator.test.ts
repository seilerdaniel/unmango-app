import { describe, it, expect } from 'vitest'
import {
  computePresentValue,
  computeBreakEvenInflationPercent,
  buildInterestFreeOption,
  simulateInstallmentPurchase,
  round2,
} from '../installmentSimulator'

describe('computePresentValue', () => {
  it('con inflación 0% el valor presente es el nominal exacto', () => {
    expect(computePresentValue(20000, 6, 0)).toBe(120000)
    expect(computePresentValue(100000, 1, 0)).toBe(100000)
  })

  it('con inflación positiva el valor presente es menor al nominal', () => {
    expect(computePresentValue(10000, 12, 8)).toBeLessThan(120000)
  })

  it('12 cuotas de 10000 con 8% mensual → 75360.78', () => {
    expect(computePresentValue(10000, 12, 8)).toBeCloseTo(75360.78, 1)
  })

  it('6 cuotas de 20000 con 5% mensual → 101513.84', () => {
    expect(computePresentValue(20000, 6, 5)).toBeCloseTo(101513.84, 1)
  })

  it('una sola cuota se descuenta un período (10% → 90909.09)', () => {
    expect(computePresentValue(100000, 1, 10)).toBeCloseTo(90909.09, 1)
  })

  it('con 0 cuotas devuelve 0', () => {
    expect(computePresentValue(10000, 0, 5)).toBe(0)
  })

  it('soporta inflación negativa (deflación): el valor presente crece', () => {
    expect(computePresentValue(10000, 12, -2)).toBeGreaterThan(120000)
  })
})

describe('computeBreakEvenInflationPercent', () => {
  it('cuotas sin interés (nominal = contado) → break-even en 0%', () => {
    expect(computeBreakEvenInflationPercent(120000, 20000, 6)).toBe(0)
  })

  it('nominal menor al contado → ya conviene desde 0%', () => {
    expect(computeBreakEvenInflationPercent(120000, 9500, 12)).toBe(0)
  })

  it('12 cuotas de 10000 contra 100000 → break-even ≈ 2.92% mensual', () => {
    const be = computeBreakEvenInflationPercent(100000, 10000, 12)
    expect(be).toBeGreaterThan(2)
    expect(be).toBeLessThan(4)
    // En el break-even el valor presente empata al contado (be está
    // redondeado a 2 decimales, por eso el margen no es a centavo)
    expect(Math.abs(computePresentValue(10000, 12, be) - 100000)).toBeLessThan(25)
  })

  it('a inflación por encima del break-even financiar pasa a convenir', () => {
    const be = computeBreakEvenInflationPercent(100000, 10000, 12)
    const above = computePresentValue(10000, 12, be + 1)
    expect(above).toBeLessThan(100000)
  })

  it('valores degenerados no rompen', () => {
    expect(computeBreakEvenInflationPercent(0, 10000, 12)).toBe(0)
    expect(computeBreakEvenInflationPercent(100000, 0, 12)).toBe(0)
    expect(computeBreakEvenInflationPercent(100000, 10000, 0)).toBe(0)
  })
})

describe('buildInterestFreeOption', () => {
  it('divide el contado en partes iguales', () => {
    const opt = buildInterestFreeOption(6, 120000)
    expect(opt.installmentsCount).toBe(6)
    expect(opt.installmentAmount).toBe(20000)
  })

  it('redondea a centavos y no divide por cero', () => {
    expect(buildInterestFreeOption(3, 100).installmentAmount).toBe(33.33)
    expect(buildInterestFreeOption(0, 100).installmentAmount).toBe(0)
  })
})

describe('simulateInstallmentPurchase', () => {
  it('compara varias opciones y calcula totalNominal y valor presente', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 120000,
      monthlyInflationPercent: 5,
      options: [
        { id: 'a', installmentsCount: 6, installmentAmount: 20000 },
        { id: 'b', installmentsCount: 3, installmentAmount: 40000 },
      ],
    })

    expect(results).toHaveLength(2)
    expect(results[0].totalNominal).toBe(120000)
    expect(results[0].presentValue).toBeCloseTo(101513.84, 1)
    expect(results[0].savingsVsCash).toBeCloseTo(18486.16, 0)
    expect(results[0].recommendation).toBe('cuotas')
  })

  it('marca como mejor opción la de mayor ahorro en valor presente', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 120000,
      monthlyInflationPercent: 5,
      options: [
        { id: 'a', installmentsCount: 6, installmentAmount: 20000 }, // PV ≈ 101514 → ahorra ~18486
        { id: 'b', installmentsCount: 3, installmentAmount: 40000 }, // PV = 108933 → ahorra ~11067
      ],
    })

    expect(results.find((r) => r.id === 'a')?.isBestOption).toBe(true)
    expect(results.find((r) => r.id === 'b')?.isBestOption).toBe(false)
  })

  it('sin inflación y con nominal igual al contado recomienda contado', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 120000,
      monthlyInflationPercent: 0,
      options: [{ id: 'a', installmentsCount: 6, installmentAmount: 20000 }],
    })
    expect(results[0].recommendation).toBe('contado')
    expect(results[0].savingsVsCash).toBe(0)
  })

  it('con recargo nominal y sin inflación, financiar sale más caro (contado)', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 100000,
      monthlyInflationPercent: 0,
      options: [{ id: 'a', installmentsCount: 12, installmentAmount: 10000 }],
    })
    expect(results[0].recommendation).toBe('contado')
    expect(results[0].savingsVsCash).toBeLessThan(0)
  })

  it('cuotas sin interés + inflación alta → conviene financiar y break-even 0', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 120000,
      monthlyInflationPercent: 5,
      options: [{ id: 'a', installmentsCount: 6, installmentAmount: 20000 }],
    })
    expect(results[0].recommendation).toBe('cuotas')
    expect(results[0].breakEvenInflationPercent).toBe(0)
  })

  it('una sola opción es siempre la mejor', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 100000,
      monthlyInflationPercent: 8,
      options: [{ id: 'a', installmentsCount: 12, installmentAmount: 10000 }],
    })
    expect(results[0].isBestOption).toBe(true)
  })

  it('sin opciones devuelve lista vacía', () => {
    expect(
      simulateInstallmentPurchase({ cashPrice: 100000, monthlyInflationPercent: 5, options: [] })
    ).toEqual([])
  })

  it('inflación extrema no rompe ni devuelve infinitos', () => {
    const results = simulateInstallmentPurchase({
      cashPrice: 100000,
      monthlyInflationPercent: 10000,
      options: [{ id: 'a', installmentsCount: 12, installmentAmount: 10000 }],
    })
    expect(Number.isFinite(results[0].presentValue)).toBe(true)
    expect(Number.isFinite(results[0].breakEvenInflationPercent)).toBe(true)
  })
})

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(3.3333)).toBe(3.33)
    expect(round2(0)).toBe(0)
  })
})
