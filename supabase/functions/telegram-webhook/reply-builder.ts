// Lógica pura de respuestas del bot, sin Deno ni Telegram, para poder
// testearla con Vitest igual que el resto del proyecto.
//
// Nota de duplicación: computeSafeToSpend / getDaysRemainingInMonth son
// conceptualmente lo mismo que src/lib/safeToSpend.ts del frontend, pero
// reescritas acá porque esta función corre en Deno, un runtime aparte del
// build de Next.js — no se puede importar el archivo del frontend. Si
// cambiás la fórmula de safe-to-spend, replicá el cambio en ambos lados
// (y en SafeToSpendWidget.tsx).

export type SafeToSpendStatus = 'safe' | 'tight' | 'over'

export type BillingFrequency = 'monthly' | 'annual'

export function monthlyEquivalentAmount(amount: number, frequency: BillingFrequency): number {
  return frequency === 'annual' ? amount / 12 : amount
}

export interface SafeToSpendInput {
  totalBalance: number
  monthlyFixedCommitments: number
  budgetedAllocations: number
  savingsContributions: number
  installmentCommitments: number
  monthlyIncome: number
  daysRemaining: number
}

export interface SafeToSpendResult {
  availableBalance: number
  daysRemaining: number
  dailyLimit: number
  status: SafeToSpendStatus
}

export function getDaysRemainingInMonth(today: Date): number {
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return daysInMonth - dayOfMonth + 1
}

export function tightStatusThreshold(monthlyIncome: number): number {
  return (monthlyIncome / 30) * 0.1
}

export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const {
    totalBalance,
    monthlyFixedCommitments,
    budgetedAllocations,
    savingsContributions,
    installmentCommitments,
    monthlyIncome,
    daysRemaining,
  } = input

  const commitments =
    monthlyFixedCommitments + budgetedAllocations + savingsContributions + installmentCommitments
  const availableBalance = totalBalance - commitments

  const safeDays = Math.max(1, daysRemaining)
  const dailyLimit = Math.max(0, availableBalance / safeDays)

  let status: SafeToSpendStatus = 'safe'
  if (availableBalance <= 0) {
    status = 'over'
  } else if (dailyLimit < tightStatusThreshold(monthlyIncome)) {
    status = 'tight'
  }

  return { availableBalance, daysRemaining, dailyLimit, status }
}

/**
 * Formatea un monto en pesos argentinos, igual que el frontend:
 * separador de miles con punto, decimales con coma, prefijo $.
 */
export function formatArs(amount: number): string {
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `$${formatted}`
}

export const HELP_TEXT = `Estos son los comandos que entiendo:

/saldo — tu saldo total en billeteras
/gastado — cuánto gastaste este mes
/safetospend — cuánto podés gastar hoy sin romper tus compromisos
/ayuda — este mensaje

También podés mandarme gastos en texto libre, por ejemplo:
"Gasto 4500 café" o "12000 supermercado".`

export function buildHelpReply(): string {
  return HELP_TEXT
}

export function buildLinkSuccessReply(): string {
  return '¡Listo! Tu Telegram ya está vinculado a UnMango. A partir de ahora, mandame mensajes tipo "Gasto 4500 café" y los registro automáticamente.'
}

export function buildLinkInvalidReply(): string {
  return 'Ese código no es válido. Generá uno nuevo desde la app (Configuración → Vincular Telegram).'
}

export function buildLinkErrorReply(): string {
  return 'Hubo un error vinculando tu cuenta. Probá de nuevo en un rato.'
}

export function buildNotLinkedReply(): string {
  return 'Todavía no vinculaste tu cuenta. Generá un código desde la app (Configuración → Vincular Telegram) y mandámelo acá primero.'
}

export function buildUnknownCommandReply(command: string): string {
  return `No conozco el comando /${command}. Mandame /ayuda para ver todo lo que puedo hacer.`
}

export function buildUnrecognizedReply(): string {
  return 'No entendí ese mensaje. Mandame algo tipo "Gasto 4500 café", un comando como /saldo, o el código de 6 dígitos que te dio la app si todavía no vinculaste tu cuenta.'
}

export function buildExpenseConfirmedReply(amount: number, description: string): string {
  return `Listo ✅ Registré un gasto de ${formatArs(amount)} en "${description}".`
}

export function buildExpenseErrorReply(): string {
  return 'Hubo un error registrando el gasto. Probá de nuevo.'
}

export function buildSaldoReply(totalBalance: number, walletCount: number): string {
  if (walletCount === 0) {
    return 'Todavía no creaste ninguna billetera. Creá una desde la app (Billeteras) y volvé a preguntarme /saldo.'
  }
  return `Tu saldo total es ${formatArs(totalBalance)} (sumando tus ${walletCount} billetera${walletCount === 1 ? '' : 's'}).`
}

export function buildGastadoReply(monthlyExpense: number, monthlyIncome: number): string {
  const base = `Gastaste ${formatArs(monthlyExpense)} este mes.`
  if (monthlyIncome > 0) {
    const percent = Math.round((monthlyExpense / monthlyIncome) * 100)
    return `${base} Eso es el ${percent}% de tu ingreso del mes (${formatArs(monthlyIncome)}).`
  }
  return `${base} Cargá tu ingreso mensual en la app (Configuración → Costo en Horas de Trabajo) para ver el porcentaje que representa.`
}

export function buildSafeToSpendReply(
  result: SafeToSpendResult,
  totalBalance: number
): string {
  const { availableBalance, dailyLimit, daysRemaining, status } = result

  const statusLabel =
    status === 'safe'
      ? '✅ Seguro'
      : status === 'tight'
        ? '⚠️ Ajustado'
        : '⛔ Sobregastado'

  const lines = [
    `${statusLabel} — podés gastar ${formatArs(dailyLimit)} por día durante los ${daysRemaining} días que quedan del mes.`,
    '',
    `Disponible en billeteras: ${formatArs(totalBalance)}`,
    `Queda disponible tras compromisos: ${formatArs(availableBalance)}`,
  ]

  if (status === 'over') {
    lines.push('Tus compromisos del mes ya superan el balance disponible.')
  }

  return lines.join('\n')
}
