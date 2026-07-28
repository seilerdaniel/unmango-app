import { describe, it, expect } from 'vitest'
import {
  daysUntilNextBilling,
  selectDueForReminder,
  groupByUser,
  buildReminderEmailHtml,
  type RecurringExpenseForReminder,
} from './date-utils'

describe('daysUntilNextBilling', () => {
  it('calcula 0 días cuando el vencimiento es hoy', () => {
    const today = new Date(2026, 6, 15) // 15 de julio de 2026
    expect(daysUntilNextBilling(15, today)).toBe(0)
  })

  it('calcula los días restantes dentro del mismo mes', () => {
    const today = new Date(2026, 6, 10) // 10 de julio
    expect(daysUntilNextBilling(15, today)).toBe(5)
  })

  it('salta al mes siguiente si el día ya pasó este mes', () => {
    const today = new Date(2026, 6, 20) // 20 de julio, billing_day 5 ya pasó
    // Del 20 de julio al 5 de agosto: 11 (resto de julio) + 5 = 16 días
    expect(daysUntilNextBilling(5, today)).toBe(16)
  })

  it('clampea al último día del mes si billing_day no existe (ej. 31 en febrero)', () => {
    const today = new Date(2026, 1, 20) // 20 de febrero de 2026 (no bisiesto: 28 días)
    // billing_day 31 clampeado a 28 (último día de febrero 2026)
    expect(daysUntilNextBilling(31, today)).toBe(8)
  })
})

describe('selectDueForReminder', () => {
  const today = new Date(2026, 6, 10)

  const items: RecurringExpenseForReminder[] = [
    { id: '1', user_id: 'u1', title: 'Netflix', amount: 5000, currency: 'ARS', billing_day: 13 }, // en 3 días
    { id: '2', user_id: 'u1', title: 'Spotify', amount: 10, currency: 'USD', billing_day: 20 }, // en 10 días
    { id: '3', user_id: 'u2', title: 'Gimnasio', amount: 8000, currency: 'ARS', billing_day: 13 }, // en 3 días
  ]

  it('selecciona solo las que vencen exactamente en la ventana de aviso', () => {
    const due = selectDueForReminder(items, 3, today)
    expect(due.map((i) => i.id)).toEqual(['1', '3'])
  })

  it('no selecciona nada si ninguna cae justo en la ventana', () => {
    const due = selectDueForReminder(items, 1, today)
    expect(due).toHaveLength(0)
  })
})

describe('groupByUser', () => {
  it('agrupa correctamente varias suscripciones del mismo usuario', () => {
    const items: RecurringExpenseForReminder[] = [
      { id: '1', user_id: 'u1', title: 'Netflix', amount: 5000, currency: 'ARS', billing_day: 13 },
      { id: '2', user_id: 'u1', title: 'Disney+', amount: 3000, currency: 'ARS', billing_day: 13 },
      { id: '3', user_id: 'u2', title: 'Gimnasio', amount: 8000, currency: 'ARS', billing_day: 13 },
    ]

    const grouped = groupByUser(items)

    expect(grouped.get('u1')).toHaveLength(2)
    expect(grouped.get('u2')).toHaveLength(1)
    expect(grouped.size).toBe(2)
  })
})

describe('buildReminderEmailHtml', () => {
  it('incluye el nombre y el monto de cada suscripción', () => {
    const html = buildReminderEmailHtml([
      { id: '1', user_id: 'u1', title: 'Netflix', amount: 5000, currency: 'ARS', billing_day: 13 },
    ])
    expect(html).toContain('Netflix')
    expect(html).toContain('5000')
  })
})
