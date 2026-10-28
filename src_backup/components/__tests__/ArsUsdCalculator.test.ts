import { describe, it, expect } from 'vitest'
import { arsToUsd, usdToArs } from '../ArsUsdCalculator'

describe('arsToUsd', () => {
  it('convierte correctamente con una cotización válida', () => {
    expect(arsToUsd(1450, 1450)).toBeCloseTo(1)
    expect(arsToUsd(2900, 1450)).toBeCloseTo(2)
  })

  it('devuelve null si la cotización es 0 o negativa', () => {
    expect(arsToUsd(1000, 0)).toBeNull()
    expect(arsToUsd(1000, -5)).toBeNull()
  })

  it('devuelve null si el monto no es un número finito', () => {
    expect(arsToUsd(NaN, 1450)).toBeNull()
  })
})

describe('usdToArs', () => {
  it('convierte correctamente con una cotización válida', () => {
    expect(usdToArs(1, 1450)).toBeCloseTo(1450)
    expect(usdToArs(2.5, 1000)).toBeCloseTo(2500)
  })

  it('devuelve null si la cotización es 0 o negativa', () => {
    expect(usdToArs(10, 0)).toBeNull()
  })

  it('es la inversa de arsToUsd', () => {
    const rate = 1320
    const ars = 5000
    const usd = arsToUsd(ars, rate)!
    expect(usdToArs(usd, rate)).toBeCloseTo(ars)
  })
})
