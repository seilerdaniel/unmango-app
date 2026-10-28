import { describe, it, expect } from 'vitest'
import { computeZeroSpendStats, computeStreakBreak } from '../zeroSpendStats'

describe('computeZeroSpendStats', () => {
  it('cuenta todos los días como "cero gasto" si no hubo ningún gasto', () => {
    const today = new Date(2026, 6, 10) // 10 de julio
    const stats = computeZeroSpendStats([], today)
    expect(stats.daysElapsed).toBe(10)
    expect(stats.zeroSpendDays).toBe(10)
    expect(stats.currentStreak).toBe(10)
  })

  it('resta los días con gasto del conteo de días sin gasto', () => {
    const today = new Date(2026, 6, 10)
    // Hubo gasto los días 2, 5 y 10
    const stats = computeZeroSpendStats([2, 5, 10], today)
    expect(stats.daysElapsed).toBe(10)
    expect(stats.zeroSpendDays).toBe(7) // 10 - 3
  })

  it('la racha actual es 0 si hubo gasto hoy', () => {
    const today = new Date(2026, 6, 10)
    const stats = computeZeroSpendStats([10], today)
    expect(stats.currentStreak).toBe(0)
  })

  it('la racha actual corta al primer día con gasto yendo hacia atrás', () => {
    const today = new Date(2026, 6, 10)
    // Gasto el día 7 → la racha desde hoy hacia atrás es 10, 9, 8 = 3 días
    const stats = computeZeroSpendStats([7], today)
    expect(stats.currentStreak).toBe(3)
  })

  it('funciona bien a principio de mes', () => {
    const today = new Date(2026, 6, 3)
    const stats = computeZeroSpendStats([1], today)
    expect(stats.zeroSpendDays).toBe(2) // días 2 y 3
    expect(stats.currentStreak).toBe(2)
  })
})

describe('computeStreakBreak', () => {
  it('devuelve la racha previa si hoy hubo gasto y venía una racha', () => {
    // Hoy es el día 10, hubo gasto el 10. Días 6,7,8,9 sin gasto (4 seguidos antes de hoy).
    const today = new Date(2026, 6, 10)
    expect(computeStreakBreak([10], today)).toBe(9) // del 1 al 9 sin gasto (9 días)
  })

  it('devuelve null si hoy no hubo gasto (no se rompió nada)', () => {
    const today = new Date(2026, 6, 10)
    expect(computeStreakBreak([5], today)).toBeNull()
  })

  it('devuelve null si no había ninguna racha antes de hoy (gasto también ayer)', () => {
    const today = new Date(2026, 6, 10)
    expect(computeStreakBreak([9, 10], today)).toBeNull()
  })
})
