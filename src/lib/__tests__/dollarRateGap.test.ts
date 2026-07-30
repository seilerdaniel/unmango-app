import { describe, it, expect } from 'vitest'
import { computeRateGapPercent } from '../dollarRateGap'

describe('computeRateGapPercent', () => {
  it('calcula el % de diferencia contra el oficial', () => {
    expect(computeRateGapPercent(1000, 1450)).toBeCloseTo(45)
  })

  it('devuelve null si falta alguna de las dos cotizaciones', () => {
    expect(computeRateGapPercent(null, 1450)).toBeNull()
    expect(computeRateGapPercent(1000, null)).toBeNull()
  })

  it('devuelve null si el oficial es 0 (evita división por cero)', () => {
    expect(computeRateGapPercent(0, 1450)).toBeNull()
  })

  it('devuelve 0 si son iguales', () => {
    expect(computeRateGapPercent(1000, 1000)).toBe(0)
  })
})
