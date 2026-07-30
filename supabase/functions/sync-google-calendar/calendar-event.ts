// Lógica pura, sin nada de Deno, para poder testear con Vitest igual
// que el resto del proyecto. index.ts (la Edge Function en sí) importa
// esto.
//
// Nota de duplicación: el cálculo de "próximo vencimiento" es
// conceptualmente el mismo que src/lib/recurringBilling.ts del
// frontend, pero está reescrito acá porque esta función corre en Deno,
// un runtime aparte del build de Next.js. Si cambiás la lógica de
// vencimientos en un lado, replicá el cambio en el otro.

export type BillingFrequency = 'monthly' | 'annual'

function clampToLastDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

export function nextDueDate(
  billingDay: number,
  frequency: BillingFrequency,
  billingMonth: number | null,
  today: Date = new Date()
): Date {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)

  if (frequency === 'annual' && billingMonth) {
    const monthIndex = billingMonth - 1
    const year = start.getFullYear()
    let next = new Date(year, monthIndex, clampToLastDayOfMonth(year, monthIndex, billingDay))
    if (next < start) {
      next = new Date(year + 1, monthIndex, clampToLastDayOfMonth(year + 1, monthIndex, billingDay))
    }
    return next
  }

  const year = start.getFullYear()
  const month = start.getMonth()
  let next = new Date(year, month, clampToLastDayOfMonth(year, month, billingDay))
  if (next < start) {
    next = new Date(year, month + 1, clampToLastDayOfMonth(year, month + 1, billingDay))
  }
  return next
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface RecurringExpenseForCalendar {
  id: string
  title: string
  amount: number
  currency: 'ARS' | 'USD'
  billing_day: number
  billing_frequency: BillingFrequency
  billing_month: number | null
  expense_kind: 'subscription' | 'utility_rent'
}

export interface GoogleCalendarEventPayload {
  summary: string
  description: string
  start: { date: string }
  end: { date: string }
  reminders: {
    useDefault: false
    overrides: { method: 'popup'; minutes: number }[]
  }
}

/**
 * Arma el payload del evento de Google Calendar para una suscripción o
 * servicio/alquiler: evento de día completo en la fecha de vencimiento,
 * con recordatorios 3 días y 1 día antes.
 */
export function buildCalendarEvent(item: RecurringExpenseForCalendar, today: Date = new Date()): GoogleCalendarEventPayload {
  const due = nextDueDate(item.billing_day, item.billing_frequency, item.billing_month, today)
  const dueStr = formatDateOnly(due)
  const kindLabel = item.expense_kind === 'subscription' ? 'Suscripción' : 'Servicio/Alquiler'
  const amountLabel = item.currency === 'USD' ? `USD ${item.amount}` : `$${item.amount}`

  return {
    summary: `💰 ${item.title} (${amountLabel})`,
    description: `${kindLabel} — generado automáticamente por UnMango.`,
    start: { date: dueStr },
    end: { date: dueStr },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 3 * 24 * 60 },
        { method: 'popup', minutes: 24 * 60 },
      ],
    },
  }
}
