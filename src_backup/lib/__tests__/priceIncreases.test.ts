import { describe, it, expect } from 'vitest'
import { detectPriceIncreases } from '../priceIncreases'

describe('detectPriceIncreases', () => {
  it('detecta un aumento y calcula el porcentaje correcto', () => {
    const result = detectPriceIncreases([
      { recurringExpenseId: '1', currentAmount: 5500, previousAmount: 5000, currency: 'ARS' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].increasePercent).toBeCloseTo(10)
  })

  it('ignora las que bajaron de precio', () => {
    const result = detectPriceIncreases([
      { recurringExpenseId: '1', currentAmount: 4000, previousAmount: 5000, currency: 'ARS' },
    ])
    expect(result).toHaveLength(0)
  })

  it('ignora las que se mantuvieron igual', () => {
    const result = detectPriceIncreases([
      { recurringExpenseId: '1', currentAmount: 5000, previousAmount: 5000, currency: 'ARS' },
    ])
    expect(result).toHaveLength(0)
  })

  it('ignora las que no tienen historial previo (primera carga)', () => {
    const result = detectPriceIncreases([
      { recurringExpenseId: '1', currentAmount: 5000, previousAmount: null, currency: 'ARS' },
    ])
    expect(result).toHaveLength(0)
  })
})
