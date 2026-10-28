import { describe, it, expect } from 'vitest'
import { projectMonthEnd } from '../monthProjection'

describe('projectMonthEnd', () => {
  it('proyecta el gasto variable extrapolando el promedio diario', () => {
    const result = projectMonthEnd({
      variableSpendSoFar: 10000, // gastados en 10 días
      fixedMonthlyCosts: 0,
      monthlyIncome: 0,
      dayOfMonth: 10,
      daysInMonth: 30,
    })
    // Promedio diario: 1000. Mes completo (30 días): 30000.
    expect(result.averageDailyVariableSpend).toBe(1000)
    expect(result.projectedVariableSpend).toBe(30000)
  })

  it('suma los gastos fijos al total proyectado', () => {
    const result = projectMonthEnd({
      variableSpendSoFar: 10000,
      fixedMonthlyCosts: 50000,
      monthlyIncome: 0,
      dayOfMonth: 10,
      daysInMonth: 30,
    })
    expect(result.projectedTotalExpense).toBe(30000 + 50000)
  })

  it('calcula el balance proyectado como ingreso menos gasto total proyectado', () => {
    const result = projectMonthEnd({
      variableSpendSoFar: 10000,
      fixedMonthlyCosts: 20000,
      monthlyIncome: 100000,
      dayOfMonth: 10,
      daysInMonth: 30,
    })
    // Gasto proyectado: 30000 (variable) + 20000 (fijo) = 50000
    expect(result.projectedBalance).toBe(100000 - 50000)
  })

  it('no rompe si es el primer día del mes (evita división por cero)', () => {
    const result = projectMonthEnd({
      variableSpendSoFar: 0,
      fixedMonthlyCosts: 20000,
      monthlyIncome: 100000,
      dayOfMonth: 0,
      daysInMonth: 30,
    })
    expect(result.averageDailyVariableSpend).toBe(0)
    expect(result.projectedVariableSpend).toBe(0)
  })
})
