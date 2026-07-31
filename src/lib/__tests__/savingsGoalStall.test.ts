import { describe, it, expect } from 'vitest'
import { isGoalStalled } from '../savingsGoalStall'

describe('isGoalStalled', () => {
  it('no está estancada si ya tiene algo cargado, sin importar la fecha', () => {
    const old = new Date(2020, 0, 1).toISOString()
    expect(isGoalStalled(1000, old)).toBe(false)
  })

  it('está estancada si sigue en 0 y pasaron 60+ días', () => {
    const today = new Date(2026, 6, 1)
    const createdAt = new Date(2026, 3, 1).toISOString() // ~91 días antes
    expect(isGoalStalled(0, createdAt, today)).toBe(true)
  })

  it('no está estancada si está en 0 pero es reciente', () => {
    const today = new Date(2026, 6, 1)
    const createdAt = new Date(2026, 6, 1).toISOString() // recién creada
    expect(isGoalStalled(0, createdAt, today)).toBe(false)
  })

  it('el límite es justo en 60 días (59 no alcanza)', () => {
    const today = new Date(2026, 2, 1) // 1 de marzo
    const createdAt = new Date(2026, 0, 1).toISOString() // 1 de enero (59 días, 2026 no es bisiesto)
    expect(isGoalStalled(0, createdAt, today)).toBe(false)
  })
})
