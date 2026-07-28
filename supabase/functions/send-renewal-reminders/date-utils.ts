// Lógica pura, sin nada de Deno, para poder testear con Vitest igual que
// el resto del proyecto. index.ts (la Edge Function en sí) importa esto.
//
// IMPORTANTE: esta es la MISMA lógica que
// src/components/RecurringManager.tsx (daysUntilNextBilling). Están
// duplicadas a propósito porque viven en runtimes distintos (esto corre
// en Deno, fuera del build de Next.js/Vitest de la app). Si cambiás la
// ventana de aviso o la lógica de vencimiento en un lado, replicá el
// cambio en el otro.

export function daysUntilNextBilling(billingDay: number, today: Date): number {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)

  const clampToLastDayOfMonth = (year: number, month: number, day: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return Math.min(day, lastDay)
  }

  const year = start.getFullYear()
  const month = start.getMonth()

  let nextBilling = new Date(year, month, clampToLastDayOfMonth(year, month, billingDay))
  if (nextBilling < start) {
    nextBilling = new Date(year, month + 1, clampToLastDayOfMonth(year, month + 1, billingDay))
  }

  const diffMs = nextBilling.getTime() - start.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export interface RecurringExpenseForReminder {
  id: string
  user_id: string
  title: string
  amount: number
  currency: 'ARS' | 'USD'
  billing_day: number
}

/**
 * Filtra las suscripciones activas que vencen exactamente dentro de
 * `reminderDaysBefore` días (para mandar un solo email por vencimiento,
 * no uno por día en la ventana).
 */
export function selectDueForReminder(
  items: RecurringExpenseForReminder[],
  reminderDaysBefore: number,
  today: Date = new Date()
): RecurringExpenseForReminder[] {
  return items.filter((item) => daysUntilNextBilling(item.billing_day, today) === reminderDaysBefore)
}

/**
 * Agrupa las suscripciones a recordar por user_id, para mandar un solo
 * email por usuario aunque tenga varias suscripciones venciendo el mismo
 * día.
 */
export function groupByUser(
  items: RecurringExpenseForReminder[]
): Map<string, RecurringExpenseForReminder[]> {
  const map = new Map<string, RecurringExpenseForReminder[]>()
  for (const item of items) {
    const existing = map.get(item.user_id)
    if (existing) {
      existing.push(item)
    } else {
      map.set(item.user_id, [item])
    }
  }
  return map
}

export function buildReminderEmailHtml(items: RecurringExpenseForReminder[]): string {
  const rows = items
    .map(
      (item) =>
        `<li>${item.title} — ${item.currency === 'USD' ? 'USD ' : '$'}${item.amount}</li>`
    )
    .join('')

  return `
    <div style="font-family: sans-serif; color: #111827;">
      <p>Hola 👋</p>
      <p>Estas suscripciones tuyas en <strong>UnMango</strong> vencen pronto:</p>
      <ul>${rows}</ul>
      <p style="color:#6b7280; font-size: 12px;">Este es un recordatorio automático de UnMango.</p>
    </div>
  `
}
