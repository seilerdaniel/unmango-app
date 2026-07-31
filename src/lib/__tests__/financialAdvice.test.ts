import { describe, it, expect } from 'vitest'
import { generateFinancialAdvice } from '../financialAdvice'
import { FinancialHealthResult } from '../financialHealthScore'

function buildScore(overrides: Partial<Record<'savings' | 'debt' | 'emergencyFund' | 'antExpenses', number>>): FinancialHealthResult {
  const base = { savings: 70, debt: 70, emergencyFund: 70, antExpenses: 70, ...overrides }
  return {
    totalScore: Math.round((base.savings + base.debt + base.emergencyFund + base.antExpenses) / 4),
    pillars: {
      savings: { label: 'Ahorro', score: base.savings },
      debt: { label: 'Deuda', score: base.debt },
      emergencyFund: { label: 'Fondo de Emergencia', score: base.emergencyFund },
      antExpenses: { label: 'Gasto Hormiga', score: base.antExpenses },
    },
  }
}

describe('generateFinancialAdvice', () => {
  it('no genera consejos de un pilar si está en un rango saludable intermedio', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ debt: 70 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    expect(advice.find((a) => a.id.startsWith('debt-'))).toBeUndefined()
  })

  it('genera un consejo de peligro si el ahorro está muy bajo', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    const item = advice.find((a) => a.id === 'savings-low')
    expect(item?.severity).toBe('danger')
  })

  it('genera un consejo positivo si el ahorro es alto', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 90 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    expect(advice.find((a) => a.id === 'savings-high')?.severity).toBe('success')
  })

  it('avisa si alguna suscripción subió de precio', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: true,
      safeToSpendToday: 5000,
    })
    expect(advice.find((a) => a.id === 'subscription-increase')).toBeDefined()
  })

  it('avisa si el limite de gasto diario ya llegó a 0', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 0,
    })
    expect(advice.find((a) => a.id === 'safe-to-spend-zero')?.severity).toBe('danger')
  })

  it('no avisa del limite de gasto diario si no hay datos suficientes (null)', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: null,
    })
    expect(advice.find((a) => a.id === 'safe-to-spend-zero')).toBeUndefined()
  })

  it('puede generar varios consejos a la vez si varios pilares estan mal', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10, debt: 10, emergencyFund: 5, antExpenses: 20 }),
      hasSubscriptionPriceIncrease: true,
      safeToSpendToday: 0,
    })
    expect(advice.length).toBeGreaterThanOrEqual(5)
  })

  it('los consejos accionables llevan a Metas de Ahorro en Planes', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    const item = advice.find((a) => a.id === 'savings-low')
    expect(item?.action).toEqual({ label: 'Crear una Meta de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' })
  })

  it('los consejos de gasto hormiga llevan a Análisis', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ antExpenses: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    const item = advice.find((a) => a.id === 'ant-expenses-low')
    expect(item?.action?.tab).toBe('analisis')
  })

  it('los consejos positivos no tienen accion (no hay nada que "hacer")', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 90 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
    })
    const item = advice.find((a) => a.id === 'savings-high')
    expect(item?.action).toBeUndefined()
  })
})
