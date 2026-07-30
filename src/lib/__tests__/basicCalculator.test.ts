import { describe, it, expect } from 'vitest'
import { applyOperator, evaluateMathExpression } from '../basicCalculator'

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

describe('evaluateMathExpression', () => {
  it('evalúa una suma simple, como en el ejemplo del rediseño', () => {
    expect(evaluateMathExpression('2500 + 1300')).toBe(3800)
  })

  it('evalúa sin espacios', () => {
    expect(evaluateMathExpression('2500+1300')).toBe(3800)
  })

  it('respeta la precedencia: multiplicación antes que suma', () => {
    expect(evaluateMathExpression('100 + 2 * 50')).toBe(200) // 100 + 100
  })

  it('evalúa una resta', () => {
    expect(evaluateMathExpression('5000 - 1200')).toBe(3800)
  })

  it('evalúa una división', () => {
    expect(evaluateMathExpression('9000 / 3')).toBe(3000)
  })

  it('encadena varias operaciones', () => {
    expect(evaluateMathExpression('1000 + 500 - 200 + 100')).toBe(1400)
  })

  it('redondea a 2 decimales', () => {
    expect(evaluateMathExpression('10 / 3')).toBe(3.33)
  })

  it('devuelve null si es un solo número sin operadores (no es una expresión)', () => {
    expect(evaluateMathExpression('2500')).toBeNull()
  })

  it('devuelve null si está vacío', () => {
    expect(evaluateMathExpression('')).toBeNull()
    expect(evaluateMathExpression('   ')).toBeNull()
  })

  it('devuelve null ante texto inválido, sin romper', () => {
    expect(evaluateMathExpression('2500 + hola')).toBeNull()
    expect(evaluateMathExpression('2500 ++ 100')).toBeNull()
    expect(evaluateMathExpression('abc')).toBeNull()
  })

  it('devuelve null si la expresión termina en un operador incompleto', () => {
    expect(evaluateMathExpression('2500 +')).toBeNull()
  })
})
