import { describe, it, expect } from 'vitest'
import { detectAntExpenses } from '../antExpenses'

describe('detectAntExpenses', () => {
  it('filtra solo los gastos por debajo del umbral', () => {
    const result = detectAntExpenses([{ amount: 500 }, { amount: 5000 }, { amount: 1200 }], 3000)
    expect(result.count).toBe(2)
    expect(result.total).toBe(1700)
  })

  it('calcula el promedio de los gastos chicos detectados', () => {
    const result = detectAntExpenses([{ amount: 1000 }, { amount: 2000 }], 3000)
    expect(result.averageAmount).toBe(1500)
  })

  it('devuelve ceros si no hay gastos por debajo del umbral', () => {
    const result = detectAntExpenses([{ amount: 5000 }], 3000)
    expect(result.count).toBe(0)
    expect(result.total).toBe(0)
    expect(result.averageAmount).toBe(0)
  })

  it('ignora montos en 0 o negativos (no deberían existir, pero por las dudas)', () => {
    const result = detectAntExpenses([{ amount: 0 }, { amount: -100 }, { amount: 500 }], 3000)
    expect(result.count).toBe(1)
  })
})
