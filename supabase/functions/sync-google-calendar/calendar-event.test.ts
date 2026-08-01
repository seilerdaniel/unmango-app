import { describe, it, expect } from 'vitest'
import {
  nextDueDate,
  formatDateOnly,
  buildCalendarEvent,
  computeInstallmentSchedule,
  nextUnpaidInstallment,
  buildInstallmentCalendarEvent,
  buildDebtCalendarEvent,
} from './calendar-event'

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
    expect(event.summary).toContain('5.000')
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

describe('computeInstallmentSchedule', () => {
  it('arma cuotas mensuales desde la primera fecha', () => {
    const schedule = computeInstallmentSchedule(120000, 3, '2026-07-15')
    expect(schedule).toHaveLength(3)
    expect(schedule[0].installmentNumber).toBe(1)
    expect(schedule[0].dueDate.getFullYear()).toBe(2026)
    expect(schedule[0].dueDate.getMonth()).toBe(6)
    expect(schedule[0].dueDate.getDate()).toBe(15)
    expect(schedule[1].dueDate.getMonth()).toBe(7)
    expect(schedule[2].dueDate.getMonth()).toBe(8)
  })

  it('vuelca el resto del redondeo en la última cuota', () => {
    const schedule = computeInstallmentSchedule(1000, 3, '2026-01-10')
    expect(schedule.map((s) => s.amount)).toEqual([333.33, 333.33, 333.34])
    expect(schedule.reduce((acc, s) => acc + s.amount, 0)).toBe(1000)
  })

  it('devuelve un plan vacío si no hay cuotas', () => {
    expect(computeInstallmentSchedule(1000, 0, '2026-01-10')).toEqual([])
  })
})

describe('nextUnpaidInstallment', () => {
  it('devuelve la primera cuota impaga', () => {
    const next = nextUnpaidInstallment(120000, 12, '2026-07-15', [1, 2])
    expect(next?.installmentNumber).toBe(3)
    expect(next?.amount).toBe(10000)
  })

  it('devuelve null si todas las cuotas están pagas', () => {
    expect(nextUnpaidInstallment(120000, 3, '2026-07-15', [1, 2, 3])).toBeNull()
  })
})

describe('buildInstallmentCalendarEvent', () => {
  it('arma el evento para la próxima cuota impaga', () => {
    const event = buildInstallmentCalendarEvent(
      { id: 'p1', description: 'Heladera', total_amount: 180000, installments_count: 12, first_installment_date: '2026-07-15' },
      [1, 2]
    )
    expect(event).not.toBeNull()
    expect(event?.summary).toContain('Cuota 3/12')
    expect(event?.summary).toContain('Heladera')
    expect(event?.summary).toContain('$15.000')
    expect(event?.start.date).toBe('2026-09-15')
    expect(event?.end.date).toBe('2026-09-15')
    expect(event?.reminders.overrides).toHaveLength(2)
  })

  it('sin pagos previos usa la primera cuota', () => {
    const event = buildInstallmentCalendarEvent({
      id: 'p2',
      description: 'Notebook',
      total_amount: 60000,
      installments_count: 3,
      first_installment_date: '2026-08-01',
    })
    expect(event?.summary).toContain('Cuota 1/3')
    expect(event?.start.date).toBe('2026-08-01')
  })

  it('devuelve null si la compra está totalmente pagada', () => {
    const event = buildInstallmentCalendarEvent(
      { id: 'p3', description: 'Heladera', total_amount: 180000, installments_count: 3, first_installment_date: '2026-07-15' },
      [1, 2, 3]
    )
    expect(event).toBeNull()
  })
})

describe('buildDebtCalendarEvent', () => {
  it('arma el evento para una deuda a pagar pendiente con vencimiento', () => {
    const event = buildDebtCalendarEvent({
      id: 'd1',
      description: 'Préstamo con Juan',
      remaining_amount: 30000,
      currency: 'ARS',
      due_date: '2026-09-10',
      debt_type: 'debo',
    })
    expect(event?.summary).toContain('Préstamo con Juan')
    expect(event?.summary).toContain('$30.000')
    expect(event?.start.date).toBe('2026-09-10')
    expect(event?.reminders.overrides).toHaveLength(2)
  })

  it('ignora deudas donde el usuario es quien cobra', () => {
    const event = buildDebtCalendarEvent({
      id: 'd2',
      description: 'Crédito a Pedro',
      remaining_amount: 5000,
      currency: 'ARS',
      due_date: '2026-09-10',
      debt_type: 'me_deben',
    })
    expect(event).toBeNull()
  })

  it('ignora deudas saldadas o sin fecha de vencimiento', () => {
    const base = { description: 'X', currency: 'ARS' as const, debt_type: 'debo' as const }
    expect(buildDebtCalendarEvent({ id: 'd3', ...base, remaining_amount: 0, due_date: '2026-09-10' })).toBeNull()
    expect(buildDebtCalendarEvent({ id: 'd4', ...base, remaining_amount: 1000, due_date: null })).toBeNull()
  })
})
