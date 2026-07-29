import { describe, it, expect } from 'vitest'
import { applyOperator } from '../basicCalculator'

describe('applyOperator', () => {
  it('suma correctamente', () => {
    expect(applyOperator(2, 3, '+')).toBe(5)
  })

  it('resta correctamente', () => {
    expect(applyOperator(5, 3, '-')).toBe(2)
  })

  it('multiplica correctamente', () => {
    expect(applyOperator(4, 3, '×')).toBe(12)
  })

  it('divide correctamente', () => {
    expect(applyOperator(10, 4, '÷')).toBe(2.5)
  })

  it('devuelve NaN al dividir por cero, en vez de Infinity o romper', () => {
    expect(applyOperator(10, 0, '÷')).toBeNaN()
  })
})
