// Lógica pura, sin nada de Deno, para poder testear con Vitest igual
// que el resto del proyecto. index.ts (la Edge Function en sí) importa
// esto.
//
// Nota de duplicación: el cálculo de "próximo vencimiento" es
// conceptualmente el mismo que src/lib/recurringBilling.ts del
// frontend, pero está reescrito acá porque esta función corre en Deno,
// un runtime aparte del build de Next.js. Si cambiás la lógica de
// vencimientos en un lado, replicá el cambio en el otro.
//
// Lo mismo aplica a cuotas en compras (computeInstallmentSchedule es el
// equivalente a src/lib/installments.ts) y a las deudas a pagar
// (src/lib/debts.ts).

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

function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  if (currency === 'USD') return `USD ${amount}`
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

function buildReminders(): GoogleCalendarEventPayload['reminders'] {
  return {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 3 * 24 * 60 },
      { method: 'popup', minutes: 24 * 60 },
    ],
  }
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

export interface InstallmentPurchaseForCalendar {
  id: string
  description: string
  total_amount: number
  installments_count: number
  first_installment_date: string
}

export interface DebtForCalendar {
  id: string
  description: string
  remaining_amount: number
  currency: 'ARS' | 'USD'
  due_date: string | null
  debt_type: 'debo' | 'me_deben'
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

  return {
    summary: `💰 ${item.title} (${formatAmount(item.amount, item.currency)})`,
    description: `${kindLabel} — generado automáticamente por UnMango.`,
    start: { date: dueStr },
    end: { date: dueStr },
    reminders: buildReminders(),
  }
}

/**
 * Plan de cuotas de una compra: una cuota mensual por cada mes a partir
 * de la primera fecha de cuota, con el resto del redondeo volcado en la
 * última cuota (mismo criterio que src/lib/installments.ts).
 */
export interface InstallmentPlanItem {
  installmentNumber: number
  amount: number
  dueDate: Date
}

export function computeInstallmentSchedule(
  totalAmount: number,
  installmentsCount: number,
  firstInstallmentDate: string
): InstallmentPlanItem[] {
  if (installmentsCount <= 0) return []

  const first = new Date(`${firstInstallmentDate}T00:00:00`)
  const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100
  const schedule: InstallmentPlanItem[] = []
  let accumulated = 0

  for (let i = 1; i <= installmentsCount; i++) {
    const isLast = i === installmentsCount
    const amount = isLast ? Math.round((totalAmount - accumulated) * 100) / 100 : baseAmount
    accumulated += amount

    const dueDate = new Date(first)
    dueDate.setMonth(dueDate.getMonth() + (i - 1))

    schedule.push({ installmentNumber: i, dueDate, amount })
  }

  return schedule
}

/**
 * Primera cuota todavía impaga de la compra. Devolver null significa que
 * la compra está totalmente pagada (no corresponde ningún evento).
 */
export function nextUnpaidInstallment(
  totalAmount: number,
  installmentsCount: number,
  firstInstallmentDate: string,
  paidInstallmentNumbers: number[] = []
): InstallmentPlanItem | null {
  const paid = new Set(paidInstallmentNumbers)
  for (const item of computeInstallmentSchedule(totalAmount, installmentsCount, firstInstallmentDate)) {
    if (!paid.has(item.installmentNumber)) return item
  }
  return null
}

/**
 * Arma el payload del evento de Google Calendar para la próxima cuota
 * impaga de una compra en cuotas. Devolver null si ya no queda ninguna
 * cuota por pagar.
 */
export function buildInstallmentCalendarEvent(
  item: InstallmentPurchaseForCalendar,
  paidInstallmentNumbers: number[] = []
): GoogleCalendarEventPayload | null {
  const next = nextUnpaidInstallment(item.total_amount, item.installments_count, item.first_installment_date, paidInstallmentNumbers)
  if (!next) return null

  return {
    summary: `💳 Cuota ${next.installmentNumber}/${item.installments_count} ${item.description} — ${formatAmount(next.amount, 'ARS')}`,
    description: 'Compra en cuotas — generado automáticamente por UnMango.',
    start: { date: formatDateOnly(next.dueDate) },
    end: { date: formatDateOnly(next.dueDate) },
    reminders: buildReminders(),
  }
}

/**
 * Arma el payload del evento de Google Calendar para una deuda a pagar
 * (debt_type 'debo') pendiente con fecha de vencimiento. Devolver null
 * para deudas saldadas, sin fecha o donde el usuario es el que cobra
 * ('me_deben').
 */
export function buildDebtCalendarEvent(item: DebtForCalendar): GoogleCalendarEventPayload | null {
  if (item.debt_type !== 'debo' || item.remaining_amount <= 0 || !item.due_date) return null

  return {
    summary: `📄 Deuda: ${item.description} — ${formatAmount(item.remaining_amount, item.currency)}`,
    description: 'Fecha límite de deuda a pagar — generado automáticamente por UnMango.',
    start: { date: item.due_date },
    end: { date: item.due_date },
    reminders: buildReminders(),
  }
}
