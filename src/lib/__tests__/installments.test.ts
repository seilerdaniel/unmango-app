import { describe, it, expect } from 'vitest'
import { computeInstallmentSchedule, getInstallmentsDueInMonth } from '../installments'

describe('computeInstallmentSchedule', () => {
  it('divide el monto total en partes iguales cuando divide exacto', () => {
    const schedule = computeInstallmentSchedule(6000, 6, new Date(2026, 0, 15))
    expect(schedule).toHaveLength(6)
    expect(schedule.every((s) => s.amount === 1000)).toBe(true)
  })

  it('la suma de todas las cuotas da exactamente el monto total, incluso con redondeo', () => {
    const schedule = computeInstallmentSchedule(1000, 3, new Date(2026, 0, 15))
    const sum = schedule.reduce((acc, s) => acc + s.amount, 0)
    expect(sum).toBeCloseTo(1000, 2)
  })

  it('las fechas de vencimiento son mensuales consecutivas', () => {
    const schedule = computeInstallmentSchedule(3000, 3, new Date(2026, 0, 15))
    expect(schedule[0].dueDate.getMonth()).toBe(0) // enero
    expect(schedule[1].dueDate.getMonth()).toBe(1) // febrero
    expect(schedule[2].dueDate.getMonth()).toBe(2) // marzo
  })

  it('devuelve un array vacío si installmentsCount es 0 o negativo', () => {
    expect(computeInstallmentSchedule(1000, 0, new Date())).toEqual([])
  })
})

describe('getInstallmentsDueInMonth', () => {
  it('filtra solo las cuotas que vencen en el mes/año indicado', () => {
    const schedule = computeInstallmentSchedule(3000, 3, new Date(2026, 0, 15))
    const due = getInstallmentsDueInMonth(schedule, 2026, 2) // febrero
    expect(due).toHaveLength(1)
    expect(due[0].installmentNumber).toBe(2)
  })

  it('devuelve vacío si ninguna cuota vence ese mes', () => {
    const schedule = computeInstallmentSchedule(3000, 3, new Date(2026, 0, 15))
    const due = getInstallmentsDueInMonth(schedule, 2027, 1)
    expect(due).toHaveLength(0)
  })
})
