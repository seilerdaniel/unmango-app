import { describe, it, expect } from 'vitest'
import { computeDebtProgress, daysOverdue } from '../debts'

describe('computeDebtProgress', () => {
  it('calcula el monto y porcentaje pagado correctamente', () => {
    const progress = computeDebtProgress(10000, 4000)
    expect(progress.paidAmount).toBe(6000)
    expect(progress.paidPercent).toBeCloseTo(60)
    expect(progress.isPaidOff).toBe(false)
  })

  it('marca como saldada cuando el restante es 0', () => {
    const progress = computeDebtProgress(10000, 0)
    expect(progress.isPaidOff).toBe(true)
    expect(progress.paidPercent).toBe(100)
  })

  it('marca como saldada si el restante quedó negativo (pago de mas)', () => {
    const progress = computeDebtProgress(10000, -500)
    expect(progress.isPaidOff).toBe(true)
    expect(progress.paidPercent).toBe(100)
  })

  it('no rompe si el monto total es 0', () => {
    const progress = computeDebtProgress(0, 0)
    expect(progress.paidPercent).toBe(0)
  })
})

describe('daysOverdue', () => {
  it('devuelve null si no hay fecha de vencimiento', () => {
    expect(daysOverdue(null)).toBeNull()
  })

  it('es positivo cuando la fecha ya pasó', () => {
    const today = new Date(2026, 6, 20)
    expect(daysOverdue('2026-07-15', today)).toBe(5)
  })

  it('es negativo cuando la fecha todavia no llego', () => {
    const today = new Date(2026, 6, 10)
    expect(daysOverdue('2026-07-15', today)).toBe(-5)
  })

  it('es 0 el mismo dia del vencimiento', () => {
    const today = new Date(2026, 6, 15)
    expect(daysOverdue('2026-07-15', today)).toBe(0)
  })
})
