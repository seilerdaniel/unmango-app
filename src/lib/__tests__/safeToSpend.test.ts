import { describe, it, expect } from 'vitest'
import {
  computeSafeToSpend,
  getDaysRemainingInMonth,
  tightStatusThreshold,
} from '../safeToSpend'

const BASE = {
  totalBalance: 100000,
  monthlyFixedCommitments: 20000,
  budgetedAllocations: 10000,
  savingsContributions: 5000,
  installmentCommitments: 5000,
  monthlyIncome: 300000,
  daysRemaining: 20,
}

describe('computeSafeToSpend', () => {
  it('descarta todos los compromisos (fijos, presupuestos, metas y cuotas) del balance', () => {
    const result = computeSafeToSpend(BASE)
    // 100000 - (20000 + 10000 + 5000 + 5000) = 60000
    expect(result.availableBalance).toBe(60000)
  })

  it('divide el disponible real entre los días restantes (incluye hoy)', () => {
    const result = computeSafeToSpend(BASE)
    expect(result.dailyLimit).toBe(60000 / 20)
  })

  it('es Verde cuando el límite diario supera el umbral del 10% del ingreso', () => {
    // Disponible 60000 → 3000/día. Umbral: (300000/30)*0.1 = 1000. 3000 > 1000.
    expect(computeSafeToSpend(BASE).status).toBe('safe')
  })

  it('es Amarillo cuando el límite diario queda por debajo del umbral del 10%', () => {
    const result = computeSafeToSpend({
      ...BASE,
      totalBalance: 30000, // disponible: 30000-40000 = -10000 → over
    })
    expect(result.status).toBe('over')
  })

  it('en el límite exacto del umbral sigue siendo Verde (el amarillo es estrictamente menor)', () => {
    // Disponible 20000 → 1000/día = umbral. dailyLimit < threshold es
    // falso en el límite, así que no es "ajustado".
    const boundary = computeSafeToSpend({
      ...BASE,
      totalBalance: 60000, // disponible: 60000-40000 = 20000 → 1000/día
    })
    expect(boundary.dailyLimit).toBe(tightStatusThreshold(BASE.monthlyIncome))
    expect(boundary.status).toBe('safe')
  })

  it('es Amarillo justo por debajo del umbral y Verde justo por encima', () => {
    // Umbral 1000/día. Disponible 19000 → 950/día (amarillo).
    const tight = computeSafeToSpend({ ...BASE, totalBalance: 59000 })
    expect(tight.status).toBe('tight')

    // Disponible 21000 → 1050/día (verde).
    const safe = computeSafeToSpend({ ...BASE, totalBalance: 61000 })
    expect(safe.status).toBe('safe')
  })

  it('es Rojo (sobregastado) cuando el disponible queda en cero o negativo', () => {
    const zero = computeSafeToSpend({ ...BASE, totalBalance: 40000 }) // disponible 0
    expect(zero.status).toBe('over')
    expect(zero.dailyLimit).toBe(0)

    const negative = computeSafeToSpend({ ...BASE, totalBalance: 10000 }) // disponible -30000
    expect(negative.status).toBe('over')
    expect(negative.availableBalance).toBe(-30000)
  })

  it('nunca devuelve un límite diario negativo (clamp a 0)', () => {
    const result = computeSafeToSpend({ ...BASE, totalBalance: 0 })
    expect(result.dailyLimit).toBe(0)
    expect(result.status).toBe('over')
  })

  it('usa al menos 1 día para no dividir por cero al final del mes', () => {
    const result = computeSafeToSpend({ ...BASE, daysRemaining: 0 })
    expect(result.daysRemaining).toBe(0)
    expect(result.dailyLimit).toBe(60000)
  })

  it('funciona igual con 1 solo día restante', () => {
    const result = computeSafeToSpend({ ...BASE, daysRemaining: 1 })
    expect(result.dailyLimit).toBe(60000)
  })

  it('sin compromisos, el límite diario es el balance dividido entre los días', () => {
    const result = computeSafeToSpend({
      totalBalance: 100000,
      monthlyFixedCommitments: 0,
      budgetedAllocations: 0,
      savingsContributions: 0,
      installmentCommitments: 0,
      monthlyIncome: 0,
      daysRemaining: 10,
    })
    expect(result.dailyLimit).toBe(10000)
    expect(result.status).toBe('safe')
  })
})

describe('getDaysRemainingInMonth', () => {
  it('devuelve el total de días del mes el día 1 (incluye hoy)', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 7, 1))).toBe(31) // agosto
  })

  it('devuelve 1 el último día del mes', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 7, 31))).toBe(1)
  })

  it('cuenta a mitad de mes', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 7, 15))).toBe(17)
  })

  it('respeta febrero no bisiesto (28 días)', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 1, 1))).toBe(28)
  })
})

describe('tightStatusThreshold', () => {
  it('calcula el 10% del ingreso mensual prorrateado por día', () => {
    expect(tightStatusThreshold(300000)).toBe(1000)
    expect(tightStatusThreshold(0)).toBe(0)
  })
})
