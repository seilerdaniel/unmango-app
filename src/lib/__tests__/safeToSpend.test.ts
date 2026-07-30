import { describe, it, expect } from 'vitest'
import { computeSafeToSpend } from '../safeToSpend'

describe('computeSafeToSpend', () => {
  it('divide el balance disponible (menos los fijos) entre los días restantes', () => {
    expect(computeSafeToSpend(100000, 20000, 20)).toBe(4000)
  })

  it('devuelve 0 en vez de negativo si los fijos superan el balance', () => {
    expect(computeSafeToSpend(10000, 50000, 10)).toBe(0)
  })

  it('usa al menos 1 día para no dividir por cero al final del mes', () => {
    expect(computeSafeToSpend(10000, 0, 0)).toBe(10000)
  })

  it('funciona igual con 1 solo día restante', () => {
    expect(computeSafeToSpend(5000, 0, 1)).toBe(5000)
  })
})
