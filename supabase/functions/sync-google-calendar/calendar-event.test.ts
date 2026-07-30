import { describe, it, expect } from 'vitest'
import { nextDueDate, formatDateOnly, buildCalendarEvent } from './calendar-event'

describe('nextDueDate', () => {
  it('mensual: calcula la fecha dentro del mismo mes', () => {
    const today = new Date(2026, 6, 10)
    const due = nextDueDate(15, 'monthly', null, today)
    expect(due.getMonth()).toBe(6)
    expect(due.getDate()).toBe(15)
  })

  it('mensual: salta al mes siguiente si el día ya pasó', () => {
    const today = new Date(2026, 6, 20)
    const due = nextDueDate(5, 'monthly', null, today)
    expect(due.getMonth()).toBe(7)
    expect(due.getDate()).toBe(5)
  })

  it('anual: usa el mes de facturación', () => {
    const today = new Date(2026, 0, 1)
    const due = nextDueDate(15, 'annual', 3, today)
    expect(due.getMonth()).toBe(2)
    expect(due.getDate()).toBe(15)
  })

  it('anual: salta al año siguiente si ya paso', () => {
    const today = new Date(2026, 6, 1)
    const due = nextDueDate(15, 'annual', 3, today)
    expect(due.getFullYear()).toBe(2027)
  })
})

describe('formatDateOnly', () => {
  it('formatea como YYYY-MM-DD con ceros a la izquierda', () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('buildCalendarEvent', () => {
  it('arma un evento de dia completo con 2 recordatorios', () => {
    const today = new Date(2026, 6, 10)
    const event = buildCalendarEvent(
      {
        id: '1',
        title: 'Netflix',
        amount: 5000,
        currency: 'ARS',
        billing_day: 15,
        billing_frequency: 'monthly',
        billing_month: null,
        expense_kind: 'subscription',
      },
      today
    )

    expect(event.summary).toContain('Netflix')
    expect(event.summary).toContain('5000')
    expect(event.start.date).toBe('2026-07-15')
    expect(event.end.date).toBe('2026-07-15')
    expect(event.reminders.overrides).toHaveLength(2)
  })

  it('distingue el tipo (servicio/alquiler) en la descripcion', () => {
    const today = new Date(2026, 6, 10)
    const event = buildCalendarEvent(
      {
        id: '2',
        title: 'Alquiler',
        amount: 200000,
        currency: 'ARS',
        billing_day: 5,
        billing_frequency: 'monthly',
        billing_month: null,
        expense_kind: 'utility_rent',
      },
      today
    )
    expect(event.description).toContain('Servicio/Alquiler')
  })
})
