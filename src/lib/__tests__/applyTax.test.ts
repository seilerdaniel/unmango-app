import { describe, it, expect } from 'vitest'
import { applyTax } from '../applyTax'

describe('applyTax', () => {
  it('suma el porcentaje de impuesto correctamente', () => {
    expect(applyTax(1000, 21)).toBeCloseTo(1210)
  })

  it('devuelve el monto base sin cambios si el impuesto es 0', () => {
    expect(applyTax(1000, 0)).toBe(1000)
  })

  it('devuelve el monto base sin cambios si el impuesto es negativo (dato inválido)', () => {
    expect(applyTax(1000, -5)).toBe(1000)
  })

  it('funciona con impuestos combinados altos (ej. IVA + impuesto PAIS)', () => {
    expect(applyTax(100, 75)).toBeCloseTo(175)
  })
})
