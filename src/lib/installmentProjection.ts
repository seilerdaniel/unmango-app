import { computeInstallmentSchedule } from './installments'

/**
 * Utilidades (puras) para proyectar el compromiso financiero de las compras
 * en cuotas en los próximos 3, 6 o 12 meses, y desglosar cada cuota como
 * "Cuota N° X de Y". Pensadas para poder testearse con Vitest sin tocar
 * Supabase.
 */

export interface UpcomingInstallment {
  description: string
  installmentNumber: number
  totalInstallments: number
  amount: number
  year: number
  month: number // 1-12
}

export interface PurchaseProjectionInput {
  description: string
  totalAmount: number
  installmentsCount: number
  /** Fecha de la primera cuota, "YYYY-MM-DD". */
  firstInstallmentDate: string
  /** Números de cuota ya pagadas (se excluyen de la proyección). */
  paidNumbers: number[]
}

/**
 * Arma la lista de todas las cuotas pendientes (no pagadas) de todas las
 * compras, ordenadas por mes de vencimiento. Es la base para proyectar el
 * compromiso futuro mes a mes.
 */
export function buildUpcomingInstallments(
  purchases: PurchaseProjectionInput[]
): UpcomingInstallment[] {
  const out: UpcomingInstallment[] = []
  for (const p of purchases) {
    if (p.installmentsCount <= 0) continue
    const first = new Date(`${p.firstInstallmentDate}T00:00:00`)
    if (isNaN(first.getTime())) continue
    const schedule = computeInstallmentSchedule(p.totalAmount, p.installmentsCount, first)
    for (const item of schedule) {
      if (p.paidNumbers.includes(item.installmentNumber)) continue
      out.push({
        description: p.description,
        installmentNumber: item.installmentNumber,
        totalInstallments: p.installmentsCount,
        amount: item.amount,
        year: item.dueDate.getFullYear(),
        month: item.dueDate.getMonth() + 1,
      })
    }
  }
  return out.sort(
    (a, b) => a.year - b.year || a.month - b.month || a.installmentNumber - b.installmentNumber
  )
}

/** Mes desplazado `offset` meses desde `from`, en { year, month }. */
function monthOffset(from: Date, offset: number): { year: number; month: number } {
  const d = new Date(from)
  d.setMonth(d.getMonth() + offset)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export interface MonthCommitment {
  key: string
  label: string
  amount: number
  count: number
  items: UpcomingInstallment[]
}

/**
 * Agrupa las cuotas pendientes por mes, limitando el horizonte a los
 * próximos `monthsAhead` meses (incluyendo el mes actual).
 */
export function projectInstallmentCommitments(
  upcoming: UpcomingInstallment[],
  monthsAhead: number,
  now: Date = new Date()
): MonthCommitment[] {
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const end = monthOffset(now, monthsAhead - 1)
  const grouped = new Map<string, MonthCommitment>()

  for (const item of upcoming) {
    const isBeforeCurrent =
      item.year < current.year || (item.year === current.year && item.month < current.month)
    const isAfterEnd =
      item.year > end.year || (item.year === end.year && item.month > end.month)
    if (isBeforeCurrent || isAfterEnd) continue

    const key = monthKey(item.year, item.month)
    const existing = grouped.get(key)
    if (existing) {
      existing.amount += item.amount
      existing.count += 1
      existing.items.push(item)
    } else {
      grouped.set(key, {
        key,
        label: monthLabel(item.year, item.month),
        amount: item.amount,
        count: 1,
        items: [item],
      })
    }
  }

  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key))
}