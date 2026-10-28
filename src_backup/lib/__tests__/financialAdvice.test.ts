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


const NO_EXTRA_SIGNALS = {
  exceededBudgetCategoryNames: [] as string[],
  hasHighInterestDebt: false,
  largeInstallmentDescription: null as string | null,
  brokenStreakDays: null as number | null,
  stalledGoalNames: [] as string[],
  hasNoCategories: false,
  hasExpensesButNoIncome: false,
  householdUnsettledDays: null as number | null,
}

describe('generateFinancialAdvice', () => {
  it('no genera consejos de un pilar si está en un rango saludable intermedio', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ debt: 70 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.find((a) => a.id.startsWith('debt-'))).toBeUndefined()
  })

  it('genera un consejo de peligro si el ahorro está muy bajo', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    const item = advice.find((a) => a.id === 'savings-low')
    expect(item?.severity).toBe('danger')
  })

  it('genera un consejo positivo si el ahorro es alto', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 90 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.find((a) => a.id === 'savings-high')?.severity).toBe('success')
  })

  it('avisa si alguna suscripción subió de precio', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: true,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.find((a) => a.id === 'subscription-increase')).toBeDefined()
  })

  it('avisa si el limite de gasto diario ya llegó a 0', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 0,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.find((a) => a.id === 'safe-to-spend-zero')?.severity).toBe('danger')
  })

  it('no avisa del limite de gasto diario si no hay datos suficientes (null)', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: null,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.find((a) => a.id === 'safe-to-spend-zero')).toBeUndefined()
  })

  it('puede generar varios consejos a la vez si varios pilares estan mal', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10, debt: 10, emergencyFund: 5, antExpenses: 20 }),
      hasSubscriptionPriceIncrease: true,
      safeToSpendToday: 0,
      ...NO_EXTRA_SIGNALS,
    })
    expect(advice.length).toBeGreaterThanOrEqual(5)
  })

  it('los consejos accionables llevan a Metas de Ahorro en Planes', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    const item = advice.find((a) => a.id === 'savings-low')
    expect(item?.action).toEqual({ label: 'Crear una Meta de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' })
  })

  it('los consejos de gasto hormiga llevan a Análisis', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ antExpenses: 10 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    const item = advice.find((a) => a.id === 'ant-expenses-low')
    expect(item?.action?.tab).toBe('analisis')
  })

  it('los consejos positivos no tienen accion (no hay nada que "hacer")', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({ savings: 90 }),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
    })
    const item = advice.find((a) => a.id === 'savings-high')
    expect(item?.action).toBeUndefined()
  })
})

describe('generateFinancialAdvice — 5 reglas nuevas', () => {
  it('avisa si hay presupuestos excedidos', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      exceededBudgetCategoryNames: ['Supermercado'],
    })
    const item = advice.find((a) => a.id === 'budget-exceeded')
    expect(item?.message).toContain('Supermercado')
    expect(item?.action?.tab).toBe('planes')
  })

  it('menciona cuántos presupuestos más hay si son varios', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      exceededBudgetCategoryNames: ['Supermercado', 'Transporte', 'Salud'],
    })
    const item = advice.find((a) => a.id === 'budget-exceeded')
    expect(item?.message).toContain('y 1 más')
  })

  it('avisa si hay una deuda con interés alto', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      hasHighInterestDebt: true,
    })
    expect(advice.find((a) => a.id === 'high-interest-debt')).toBeDefined()
  })

  it('avisa si una cuota pesa mucho sobre el ingreso', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      largeInstallmentDescription: 'Heladera',
    })
    const item = advice.find((a) => a.id === 'large-installment')
    expect(item?.message).toContain('Heladera')
  })

  it('da un mensaje motivacional (info) si se rompió una racha larga', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      brokenStreakDays: 5,
    })
    const item = advice.find((a) => a.id === 'streak-broken')
    expect(item?.severity).toBe('info')
    expect(item?.message).toContain('5')
  })

  it('no avisa de una racha rota si fue muy corta (menos de 3 días)', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      brokenStreakDays: 1,
    })
    expect(advice.find((a) => a.id === 'streak-broken')).toBeUndefined()
  })

  it('avisa si hay una meta de ahorro estancada', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      stalledGoalNames: ['Fondo de Emergencia'],
    })
    const item = advice.find((a) => a.id === 'stalled-goal')
    expect(item?.message).toContain('Fondo de Emergencia')
    expect(item?.action?.sectionId).toBe('metas-ahorro')
  })
})

describe('generateFinancialAdvice — 3 reglas "necesitan más trabajo"', () => {
  it('avisa si no hay ninguna categoría creada, con acción de abrir Configuración', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      hasNoCategories: true,
    })
    const item = advice.find((a) => a.id === 'no-categories')
    expect(item?.action?.openSettings).toBe(true)
    expect(item?.action?.tab).toBeUndefined()
  })

  it('avisa si hay gastos pero ningún ingreso registrado', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      hasExpensesButNoIncome: true,
    })
    const item = advice.find((a) => a.id === 'no-income-registered')
    expect(item?.action?.sectionId).toBe('transaction-form')
  })

  it('avisa si el balance de hogar lleva 30+ días sin saldar', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      householdUnsettledDays: 45,
    })
    const item = advice.find((a) => a.id === 'household-unsettled')
    expect(item?.message).toContain('45')
  })

  it('no avisa del balance de hogar si lleva menos de 30 días', () => {
    const advice = generateFinancialAdvice({
      healthScore: buildScore({}),
      hasSubscriptionPriceIncrease: false,
      safeToSpendToday: 5000,
      ...NO_EXTRA_SIGNALS,
      householdUnsettledDays: 10,
    })
    expect(advice.find((a) => a.id === 'household-unsettled')).toBeUndefined()
  })
})
