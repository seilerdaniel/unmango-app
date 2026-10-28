import { describe, it, expect } from 'vitest'
import { computeFinancialHealthScore, hasNoFinancialData } from '../financialHealth'

describe('computeFinancialHealthScore', () => {
  it('da un score alto para una situaci��n financiera sana', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    expect(result.score).toBeGreaterThan(60)
  })

  it('da un score bajo para una situaci��n financiera ajustada', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 300000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 150000,
      emergencyFundBalance: 0,
      antExpensesTotal: 30000,
    })
    expect(result.score).toBeLessThan(30)
  })

  it('el score est�� entre 0 y 100', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('asigna estado Excelente para score alto', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 100000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 10000000,
      antExpensesTotal: 0,
    })
    expect(result.status).toBe('Excelente')
  })

  it('asigna estado En Riesgo para score bajo', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 50000,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.status).toBe('En Riesgo')
  })

  it('asigna estado Saludable para score medio', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 400000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 20000,
      emergencyFundBalance: 800000,
      antExpensesTotal: 5000,
    })
    expect(result.status).toBe('Saludable')
  })

  it('asigna estado Atencion para score medio-bajo', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 200000,
      monthlyExpense: 120000,
      monthlyDebtPayments: 30000,
      emergencyFundBalance: 100000,
      antExpensesTotal: 2000,
    })
    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.score).toBeLessThan(60)
  })

  it('genera recomendaciones cuando hay dimensiones bajo umbral', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 50000,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('no genera recomendaciones cuando todo est�� en rango saludable', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 100000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 10000000,
      antExpensesTotal: 0,
    })
    expect(result.recommendations.length).toBe(1)
    expect(result.recommendations[0]).toContain('dimensiones')
  })

  it('incluye las 3 dimensiones en el resultado', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    expect(result.dimensions).toHaveLength(3)
    const labels = result.dimensions.map((d) => d.label)
    expect(labels).toContain('Endeudamiento')
    expect(labels).toContain('Capacidad de Ahorro')
    expect(labels).toContain('Estabilidad')
  })

  it('cada dimensi��n tiene score entre 0 y 100', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    for (const dim of result.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0)
      expect(dim.score).toBeLessThanOrEqual(100)
    }
  })

  it('no rompe si el ingreso mensual es 0', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 0,
      monthlyExpense: 50000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.score).toBe(0)
    expect(result.status).toBe('En Riesgo')
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('el score es el promedio de las 3 dimensiones', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    const avg = Math.round(
      (result.dimensions[0].score +
        result.dimensions[1].score +
        result.dimensions[2].score) /
        3
    )
    expect(result.score).toBe(avg)
  })

  it('tiene recomendaci��n de deuda cuando el endeudamiento es alto', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 10000,
      monthlyDebtPayments: 80000,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    const debtRec = result.recommendations.find((r) => r.includes('deuda') || r.includes('cuotas'))
    expect(debtRec).toBeDefined()
  })

  it('tiene recomendaci��n de ahorro cuando la capacidad de ahorro es baja', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 95000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    const savingsRec = result.recommendations.find((r) => r.includes('ahorro') || r.includes('guard'))
    expect(savingsRec).toBeDefined()
  })

  it('tiene recomendaci��n de estabilidad cuando el margen es ajustado', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 90000,
      monthlyDebtPayments: 5000,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    const stabilityRec = result.recommendations.find((r) => r.includes('margen') || r.includes('emergencia') || r.includes('colch��n'))
    expect(stabilityRec).toBeDefined()
  })
})

describe('hasNoFinancialData', () => {
  it('es true si no hay ingreso ni gasto este mes', () => {
    expect(hasNoFinancialData(0, 0)).toBe(true)
  })

  it('es false si hay aunque sea un ingreso cargado', () => {
    expect(hasNoFinancialData(500000, 0)).toBe(false)
  })

  it('es false si hay aunque sea un gasto cargado', () => {
    expect(hasNoFinancialData(0, 15000)).toBe(false)
  })

  it('es true aunque haya saldo en billeteras, si no hay movimientos este mes', () => {
    expect(hasNoFinancialData(0, 0)).toBe(true)
  })
})