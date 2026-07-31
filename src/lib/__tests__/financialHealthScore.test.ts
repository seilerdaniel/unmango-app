import { describe, it, expect } from 'vitest'
import { computeFinancialHealthScore, hasNoFinancialData } from '../financialHealthScore'

describe('computeFinancialHealthScore', () => {
  it('da un score alto para una situación financiera sana', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    expect(result.totalScore).toBeGreaterThan(70)
  })

  it('da un score bajo para una situación financiera ajustada', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 300000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 150000,
      emergencyFundBalance: 0,
      antExpensesTotal: 30000,
    })
    expect(result.totalScore).toBeLessThan(30)
  })

  it('el pilar de ahorro nunca es negativo aunque se gaste más de lo que se gana', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.pillars.savings.score).toBe(0)
  })

  it('el pilar de fondo de emergencia se topea en 100 (no sigue subiendo pasados los 6 meses cubiertos)', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 100000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 10000000,
      antExpensesTotal: 0,
    })
    expect(result.pillars.emergencyFund.score).toBe(100)
  })

  it('no rompe si el ingreso mensual es 0', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 0,
      monthlyExpense: 50000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
  })

  it('el score total es el promedio de los 4 pilares', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 500000,
      monthlyExpense: 300000,
      monthlyDebtPayments: 25000,
      emergencyFundBalance: 1800000,
      antExpensesTotal: 5000,
    })
    const avg = Math.round(
      (result.pillars.savings.score +
        result.pillars.debt.score +
        result.pillars.emergencyFund.score +
        result.pillars.antExpenses.score) /
        4
    )
    expect(result.totalScore).toBe(avg)
  })
})

describe('hasNoFinancialData', () => {
  it('es true si no hay ingreso, gasto ni saldo en billeteras', () => {
    expect(hasNoFinancialData(0, 0, 0)).toBe(true)
  })

  it('es false si hay aunque sea un ingreso cargado', () => {
    expect(hasNoFinancialData(500000, 0, 0)).toBe(false)
  })

  it('es false si hay aunque sea saldo en billeteras', () => {
    expect(hasNoFinancialData(0, 0, 1000)).toBe(false)
  })
})
