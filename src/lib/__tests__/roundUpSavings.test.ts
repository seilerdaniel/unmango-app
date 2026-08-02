import { describe, it, expect } from 'vitest'
import { calculateRoundUp, computeTotalRoundUpSavings } from '../roundUpSavings'

describe('calculateRoundUp', () => {
  it('redondea al múltiplo superior del paso por defecto ($1.000)', () => {
    expect(calculateRoundUp(3200)).toBe(800)
    expect(calculateRoundUp(1500)).toBe(500)
    expect(calculateRoundUp(100)).toBe(900)
  })

  it('no redondea los montos que ya son múltiplo exacto', () => {
    expect(calculateRoundUp(4000)).toBe(0)
    expect(calculateRoundUp(1000)).toBe(0)
    expect(calculateRoundUp(0)).toBe(0)
  })

  it('respeta pasos de $100 y $500', () => {
    expect(calculateRoundUp(3250, 100)).toBe(50)
    expect(calculateRoundUp(3250, 500)).toBe(250)
    expect(calculateRoundUp(3200, 100)).toBe(0)
    expect(calculateRoundUp(3200, 500)).toBe(300)
  })

  it('devuelve 0 con montos inválidos o pasos no positivos', () => {
    expect(calculateRoundUp(-1500)).toBe(0)
    expect(calculateRoundUp(Number.NaN)).toBe(0)
    expect(calculateRoundUp(3200, 0)).toBe(0)
    expect(calculateRoundUp(3200, -1000)).toBe(0)
  })
})

describe('computeTotalRoundUpSavings', () => {
  it('suma el redondeo de todos los gastos del período', () => {
    const expenses = [{ amount_ars: 3200 }, { amount_ars: 1500 }, { amount_ars: 4000 }]
    expect(computeTotalRoundUpSavings(expenses)).toBe(1300)
  })

  it('ignora gastos sin monto y montos nulos', () => {
    const expenses = [{ amount_ars: null }, { amount_ars: 3200 }, { amount_ars: 4000 }]
    expect(computeTotalRoundUpSavings(expenses)).toBe(800)
  })

  it('respeta el paso elegido y evita ruido de coma flotante', () => {
    const expenses = [{ amount_ars: 3250 }, { amount_ars: 3375 }]
    expect(computeTotalRoundUpSavings(expenses, 100)).toBe(75)
    expect(computeTotalRoundUpSavings([{ amount_ars: 0.1 + 0.2 }], 100)).toBe(99.7)
  })

  it('devuelve 0 con lista vacía o sin redondeos', () => {
    expect(computeTotalRoundUpSavings([])).toBe(0)
    expect(computeTotalRoundUpSavings([{ amount_ars: 4000 }, { amount_ars: 2000 }])).toBe(0)
  })
})
