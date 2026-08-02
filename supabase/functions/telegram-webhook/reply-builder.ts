// Lógica pura de respuestas del bot, sin Deno ni Telegram, para poder
// testearla con Vitest igual que el resto del proyecto.
//
// Nota de duplicación: computeSafeToSpend / getDaysRemainingInMonth son
// conceptualmente lo mismo que src/lib/safeToSpend.ts del frontend, pero
// reescritas acá porque esta función corre en Deno, un runtime aparte del
// build de Next.js — no se puede importar el archivo del frontend. Si
// cambiás la fórmula de safe-to-spend, replicá el cambio en ambos lados
// (y en SafeToSpendWidget.tsx).
//
// Lo mismo aplica para lo demás que se replica acá desde el frontend:
// computeFinancialHealthScore / hasNoFinancialData
// (src/lib/financialHealthScore.ts), computeHouseholdBalance
// (src/lib/householdBalance.ts), detectAntExpenses
// (src/lib/antExpenses.ts), isGoalStalled (src/lib/savingsGoalStall.ts),
// computeStreakBreak (src/lib/zeroSpendStats.ts) y generateAdviceMessages
// (versión en texto de src/lib/financialAdvice.ts). Para /billeteras se
// replica get_wallet_balances() (wallets.sql) y para /vencimientos las
// fórmulas de nextBillingDate (src/lib/recurringBilling.ts),
// computeInstallmentScheduleItems (src/lib/installments.ts) y la regla
// de deudas pendientes (src/lib/debts.ts).

export type SafeToSpendStatus = 'safe' | 'tight' | 'over'

export type BillingFrequency = 'monthly' | 'annual'

export function monthlyEquivalentAmount(amount: number, frequency: BillingFrequency): number {
  return frequency === 'annual' ? round2(amount / 12) : amount
}

// Redondea a 2 decimales (centavos) evitando ruido de coma flotante.
// Es la réplica del round2 de src/lib/money.ts — ver nota de duplicación
// al inicio del archivo: este runtime corre en Deno, no puede importar
// el código del frontend.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Calcula el monto final incluyendo impuestos (% que el precio de lista
// NO incluye). Réplica de src/lib/applyTax.ts.
export function applyTax(baseAmount: number, taxPercentage: number): number {
  if (!(taxPercentage > 0)) return baseAmount
  return round2(baseAmount * (1 + taxPercentage / 100))
}

// Rendimiento diario/mensual de una billetera según su TNA (tasa nominal
// anual en %), prorrateado a 365 días y 12 meses. Réplica de
// src/lib/walletYield.ts — ver nota de duplicación al inicio del archivo.
export function walletDailyYield(balance: number, tna: number): number {
  if (balance <= 0 || !(tna > 0)) return 0
  return round2((balance * (tna / 100)) / 365)
}

export function walletMonthlyYield(balance: number, tna: number): number {
  if (balance <= 0 || !(tna > 0)) return 0
  return round2((balance * (tna / 100)) / 12)
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
/resumen o /gastos — gráfico de tus gastos del mes por categoría
/safetospend — cuánto podés gastar hoy sin romper tus compromisos
/score — tu Un Mango Score (salud financiera del mes)
/deudas — tus deudas pendientes
/cuotas — tus compras en cuotas
/metas — tus metas de ahorro
/fijos — tus suscripciones y gastos fijos
/consejos — recomendaciones según tus números
/hogar — balance de gastos de hogar con tu pareja
/billeteras — saldo individual de cada billetera
/vencimientos — lo que vence en los próximos 30 días
/ayuda — este mensaje

También podés usar los botones que te dejo sobre la caja de texto
(💳 Billeteras, 📅 Vencimientos, 🎯 Safe-to-Spend, 📊 Mi Score) o
mandarme texto libre, por ejemplo:
"Gasto 4500 café" — registra un gasto
"Debo 5000 a Juan" o "Me debe 3000 Pedro" — registra una deuda
"Pagué 5000 a Juan" o "Cobré 3000 de Pedro" — registra un pago de deuda
"Pagué Netflix 5000" o "Pago servicio Netflix 5000" — registra un pago de servicio
"Heladera 200000 en 12 cuotas" o "Heladera 200000 12 cuotas" — registra una compra en cuotas
"Pagué cuota Galicia 150000" o "Pago 1 cuota Heladera" — registra el pago de una cuota
"Suscripción 5000 Netflix" o "Alquiler 20000" — carga un gasto fijo
"Meta Vacaciones 200000" — crea una meta de ahorro`

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

export function buildExpenseConfirmedReply(
  amount: number,
  description: string,
  type: 'income' | 'expense' = 'expense',
  walletName: string | null = null,
  categoryName: string | null = null,
  notes: string | null = null
): string {
  const kindLabel = type === 'income' ? 'un ingreso' : 'un gasto'
  const extra = [walletName ? `billetera ${walletName}` : null, categoryName ? `categoría ${categoryName}` : null]
    .filter(Boolean)
    .join(' · ')
  const extrasSuffix = extra ? ` (${extra})` : ''
  const notesSuffix = notes ? ` Nota: ${notes}` : ''
  return `Listo ✅ Registré ${kindLabel} de ${formatArs(amount)} en "${description}"${extrasSuffix}.${notesSuffix}`
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

/**
 * Formatea un monto según moneda: ARS usa el formato local ($1.234,5),
 * USD un formato simple con prefijo US$ (los gastos del bot se cargan en
 * ARS, pero las deudas y los fijos pueden estar en USD).
 */
export function formatMoney(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `US$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  }
  return formatArs(amount)
}

// ---------------- Teclados y comandos nativos ----------------

export type ReplyKeyboardMarkup = {
  reply_keyboard: string[][]
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
}

export type InlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

export type TelegramReplyMarkup = ReplyKeyboardMarkup | InlineKeyboardMarkup

export interface TelegramReplyPayload {
  text: string
  /** null cuando la respuesta no lleva botones (mensaje plano). */
  replyMarkup: TelegramReplyMarkup | null
}

/**
 * Teclado principal persistente (reply_keyboard): 4 botones rápidos que
 * quedan fijos sobre la caja de texto de Telegram. Cada botón envía el
 * texto mapeado por el parser (message-parser.ts) al comando equivalente.
 */
export function buildMainReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    reply_keyboard: [
      ['💳 Billeteras'],
      ['📅 Vencimientos'],
      ['🎯 Safe-to-Spend'],
      ['📊 Mi Score'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
}

export interface BotCommand {
  command: string
  description: string
}

/**
 * Comandos nativos que se registran con setMyCommands para que aparezcan
 * en el menú de Telegram (botón "/").
 */
export const BOT_COMMANDS: BotCommand[] = [
  { command: 'ayuda', description: 'Lista de comandos y ayuda' },
  { command: 'saldo', description: 'Tu saldo total en billeteras' },
  { command: 'gastado', description: 'Cuánto gastaste este mes' },
  { command: 'resumen', description: 'Gráfico de tus gastos del mes por categoría' },
  { command: 'gastos', description: 'Gráfico de tus gastos del mes por categoría' },
  { command: 'safetospend', description: 'Cuánto podés gastar hoy sin romper compromisos' },
  { command: 'score', description: 'Tu Un Mango Score (salud financiera del mes)' },
  { command: 'deudas', description: 'Tus deudas pendientes' },
  { command: 'cuotas', description: 'Tus compras en cuotas' },
  { command: 'metas', description: 'Tus metas de ahorro' },
  { command: 'fijos', description: 'Tus suscripciones y gastos fijos' },
  { command: 'consejos', description: 'Recomendaciones según tus números' },
  { command: 'hogar', description: 'Balance de gastos de hogar con tu pareja' },
  { command: 'billeteras', description: 'Saldo individual de cada billetera' },
  { command: 'vencimientos', description: 'Lo que vence en los próximos 30 días' },
]

/** Payload para el endpoint setMyCommands de la Bot API. */
export function buildSetMyCommandsPayload(): { commands: BotCommand[] } {
  return { commands: BOT_COMMANDS }
}

/**
 * Botón inline "Marcar Pagada" para un ítem pagable (deuda o cuota).
 * El callback_data lo interpreta parseCallbackData (message-parser.ts).
 */
export function buildPayButton(callbackData: string): { text: string; callback_data: string } {
  return { text: '✅ Marcar Pagada', callback_data: callbackData }
}

// ---------------- Un Mango Score (replica de src/lib/financialHealthScore.ts) ----------------

export interface FinancialHealthPillar {
  label: string
  score: number
}

export interface FinancialHealthResult {
  totalScore: number
  pillars: {
    savings: FinancialHealthPillar
    debt: FinancialHealthPillar
    emergencyFund: FinancialHealthPillar
    antExpenses: FinancialHealthPillar
  }
}

export interface FinancialHealthInputs {
  monthlyIncome: number
  monthlyExpense: number
  /** Suma de cuotas, deudas y gastos fijos comprometidos del mes. */
  monthlyDebtPayments: number
  /** Plata "de colchón" disponible — se usa el total en billeteras. */
  emergencyFundBalance: number
  /** Total gastado del mes en compras chicas (gastos hormiga). */
  antExpensesTotal: number
}

function clampScore(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function hasNoFinancialData(monthlyIncome: number, monthlyExpense: number): boolean {
  return monthlyIncome === 0 && monthlyExpense === 0
}

export function computeFinancialHealthScore(inputs: FinancialHealthInputs): FinancialHealthResult {
  const { monthlyIncome, monthlyExpense, monthlyDebtPayments, emergencyFundBalance, antExpensesTotal } = inputs

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0
  const savingsScore = clampScore(savingsRate, 0, 100)

  const debtRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 100
  const debtScore = clampScore(100 - debtRatio, 0, 100)

  const monthsCovered = monthlyExpense > 0 ? emergencyFundBalance / monthlyExpense : 0
  const emergencyFundScore = clampScore((monthsCovered / 6) * 100, 0, 100)

  const antRatio = monthlyIncome > 0 ? (antExpensesTotal / monthlyIncome) * 100 : 0
  const antExpensesScore = clampScore(100 - antRatio * 5, 0, 100)

  const totalScore = Math.round((savingsScore + debtScore + emergencyFundScore + antExpensesScore) / 4)

  return {
    totalScore,
    pillars: {
      savings: { label: 'Ahorro', score: Math.round(savingsScore) },
      debt: { label: 'Deuda', score: Math.round(debtScore) },
      emergencyFund: { label: 'Fondo de Emergencia', score: Math.round(emergencyFundScore) },
      antExpenses: { label: 'Gasto Hormiga', score: Math.round(antExpensesScore) },
    },
  }
}

// ---------------- Balance de hogar (replica de src/lib/householdBalance.ts) ----------------

export interface HouseholdBalance {
  /** Positivo: la otra persona te debe esto. Negativo: vos le debés esto a la otra persona. */
  netBalanceForMe: number
  totalPaidByMe: number
  totalPaidByPartner: number
  totalHouseholdExpenses: number
}

export function computeHouseholdBalance(totalPaidByMe: number, totalPaidByPartner: number): HouseholdBalance {
  const totalHouseholdExpenses = totalPaidByMe + totalPaidByPartner
  const fairShare = totalHouseholdExpenses / 2
  const netBalanceForMe = totalPaidByMe - fairShare

  return {
    netBalanceForMe,
    totalPaidByMe,
    totalPaidByPartner,
    totalHouseholdExpenses,
  }
}

// ---------------- Gastos hormiga (replica de src/lib/antExpenses.ts) ----------------

export interface AntExpense {
  amount: number
}

export interface AntExpensesResult {
  count: number
  total: number
  averageAmount: number
}

export function detectAntExpenses(expenses: AntExpense[], threshold: number): AntExpensesResult {
  const small = expenses.filter((e) => e.amount > 0 && e.amount < threshold)
  const total = small.reduce((acc, e) => acc + e.amount, 0)

  return {
    count: small.length,
    total,
    averageAmount: small.length > 0 ? total / small.length : 0,
  }
}

// ---------------- Metas estancadas (replica de src/lib/savingsGoalStall.ts) ----------------

const STALLED_THRESHOLD_DAYS = 60

export function isGoalStalled(currentAmount: number, createdAt: string, today: Date = new Date()): boolean {
  if (currentAmount > 0) return false

  const created = new Date(createdAt)
  const daysSinceCreated = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceCreated >= STALLED_THRESHOLD_DAYS
}

// ---------------- Racha rota (replica de src/lib/zeroSpendStats.ts) ----------------

export function computeStreakBreak(expenseDayNumbers: number[], today: Date = new Date()): number | null {
  const todayDayOfMonth = today.getDate()
  const expenseDaysSet = new Set(expenseDayNumbers)

  if (!expenseDaysSet.has(todayDayOfMonth)) return null

  let streakBeforeToday = 0
  for (let day = todayDayOfMonth - 1; day >= 1; day--) {
    if (expenseDaysSet.has(day)) break
    streakBeforeToday++
  }
  return streakBeforeToday > 0 ? streakBeforeToday : null
}

// ---------------- Consejos (versión en texto de src/lib/financialAdvice.ts) ----------------

export interface TelegramAdviceInputs {
  healthScore: FinancialHealthResult
  safeToSpendToday: number | null
  hasSubscriptionPriceIncrease: boolean
  exceededBudgetCategoryNames: string[]
  hasHighInterestDebt: boolean
  largeInstallmentDescription: string | null
  brokenStreakDays: number | null
  stalledGoalNames: string[]
  hasNoCategories: boolean
  hasExpensesButNoIncome: boolean
  householdUnsettledDays: number | null
}

/**
 * Los mismos umbrales de generateFinancialAdvice del frontend, pero
 * devolviendo solo el texto del consejo (sin acciones de navegación,
 * que no aplican en Telegram). Función pura para poder testearla.
 */
export function generateAdviceMessages(inputs: TelegramAdviceInputs): string[] {
  const {
    healthScore,
    safeToSpendToday,
    hasSubscriptionPriceIncrease,
    exceededBudgetCategoryNames,
    hasHighInterestDebt,
    largeInstallmentDescription,
    brokenStreakDays,
    stalledGoalNames,
    hasNoCategories,
    hasExpensesButNoIncome,
    householdUnsettledDays,
  } = inputs
  const messages: string[] = []
  const { savings, debt, emergencyFund, antExpenses } = healthScore.pillars

  if (savings.score < 30) {
    messages.push('⛔ Estás gastando casi todo lo que ganás (o más). Intentá guardar aunque sea un 5-10% este mes.')
  } else if (savings.score < 60) {
    messages.push('⚠️ Tu margen de ahorro es bajo. Revisá si hay algún gasto que puedas recortar para guardar un poco más.')
  } else if (savings.score >= 80) {
    messages.push('✅ Estás ahorrando una parte importante de tu ingreso — vas bien.')
  }

  if (debt.score < 30) {
    messages.push('⛔ Tus cuotas y gastos fijos comprometidos se están comiendo una parte muy grande de tu ingreso. Pensalo dos veces antes de sumar una cuota más.')
  } else if (debt.score < 60) {
    messages.push('⚠️ Tenés bastante comprometido en cuotas y gastos fijos. Andá con cuidado antes de agregar más compromisos mensuales.')
  }

  if (emergencyFund.score < 20) {
    messages.push('⛔ Prácticamente no tenés colchón de emergencia. Un imprevisto (rotura, salud) te puede complicar bastante ahora mismo.')
  } else if (emergencyFund.score < 60) {
    messages.push('⚠️ Tu fondo de emergencia cubre menos de 3 meses de gastos. Si podés, sumá una Meta de Ahorro para ir agrandándolo.')
  } else if (emergencyFund.score >= 90) {
    messages.push('✅ Tenés un buen colchón de emergencia armado.')
  }

  if (antExpenses.score < 40) {
    messages.push('⚠️ Los gastos chicos del día a día (cafés, kiosco, delivery) están pesando bastante en tu mes — revisalos, capaz hay margen ahí.')
  }

  if (hasSubscriptionPriceIncrease) {
    messages.push('ℹ️ Alguna de tus suscripciones subió de precio este último tiempo — revisá si te sigue conviniendo.')
  }

  if (safeToSpendToday !== null && safeToSpendToday <= 0) {
    messages.push('⛔ Con el ritmo actual, ya no te queda margen para gastar este mes sin tocar tus gastos fijos comprometidos.')
  }

  if (exceededBudgetCategoryNames.length > 0) {
    const names = exceededBudgetCategoryNames.slice(0, 2).join(' y ')
    const extra = exceededBudgetCategoryNames.length > 2 ? ` (y ${exceededBudgetCategoryNames.length - 2} más)` : ''
    messages.push(`⚠️ Superaste el presupuesto de ${names}${extra} este mes.`)
  }

  if (hasHighInterestDebt) {
    messages.push('⚠️ Tenés una deuda con interés — priorizarla antes que ahorrar suele convenir más (el interés que pagás normalmente es mayor a lo que rendiría guardar esa plata).')
  }

  if (largeInstallmentDescription) {
    messages.push(`⚠️ La cuota de "${largeInstallmentDescription}" pesa bastante sobre tu ingreso mensual.`)
  }

  if (brokenStreakDays !== null && brokenStreakDays >= 3) {
    messages.push(`ℹ️ Veías ${brokenStreakDays} días seguidos sin gastos y hoy se cortó — no pasa nada, a retomarla.`)
  }

  if (stalledGoalNames.length > 0) {
    const names = stalledGoalNames.slice(0, 2).join(' y ')
    messages.push(`ℹ️ Tu meta "${names}" sigue en $0 desde hace bastante — ¿le sumamos algo este mes?`)
  }

  if (hasNoCategories) {
    messages.push('ℹ️ Todavía no creaste ninguna categoría — con categorías vas a poder ver en qué se te va la plata.')
  }

  if (hasExpensesButNoIncome) {
    messages.push('ℹ️ Tenés gastos cargados este mes pero ningún ingreso — el Score y el límite de gasto diario van a ser menos precisos hasta que lo cargues.')
  }

  if (householdUnsettledDays !== null && householdUnsettledDays >= 30) {
    messages.push(`ℹ️ Tenés gastos de hogar sin saldar desde hace ${householdUnsettledDays} días — puede ser buen momento para arreglar cuentas.`)
  }

  return messages
}

// ---------------- Items para las respuestas de listas ----------------

export interface DebtListItem {
  /** ID de la deuda, para el botón inline "Marcar Pagada" (pay_debt:[id]). */
  id?: string | null
  description: string
  counterpartyName: string
  debtType: 'debo' | 'me_deben'
  totalAmount: number
  remainingAmount: number
  currency: 'ARS' | 'USD'
}

export interface InstallmentListItem {
  /** ID de la compra, para el botón inline "Marcar Pagada" (pay_installment:[id]). */
  id?: string | null
  description: string
  totalAmount: number
  installmentsCount: number
  paidCount: number
  monthlyAmount: number
}

export interface GoalListItem {
  name: string
  targetAmount: number
  currentAmount: number
  monthlyContribution: number
}

export interface RecurringListItem {
  title: string
  amount: number
  currency: string
  expenseKind: 'subscription' | 'utility_rent'
  billingFrequency: BillingFrequency
  billingDay: number | null
}

// ---------------- Builders nuevos ----------------

export function buildDebtConfirmedReply(
  debtType: 'debo' | 'me_deben',
  amount: number,
  counterpartyName: string,
  notes: string | null = null
): string {
  const notesSuffix = notes ? ` Nota: ${notes}` : ''
  if (debtType === 'debo') {
    return `Listo ✅ Registré que le debés ${formatArs(amount)} a ${counterpartyName}.${notesSuffix}`
  }
  return `Listo ✅ Registré que ${counterpartyName} te debe ${formatArs(amount)}.${notesSuffix}`
}

export function buildInstallmentConfirmedReply(
  description: string,
  totalAmount: number,
  installmentsCount: number,
  installmentAmount: number | null = null,
  notes: string | null = null
): string {
  const monthlyAmount = installmentAmount ?? (installmentsCount > 0 ? totalAmount / installmentsCount : 0)
  const notesSuffix = notes ? ` Nota: ${notes}` : ''
  return `Listo ✅ Registré "${description}" por ${formatArs(totalAmount)} en ${installmentsCount} cuotas de ${formatArs(monthlyAmount)}.${notesSuffix}`
}

export function buildRecurringConfirmedReply(description: string, amount: number, expenseKind: 'subscription' | 'utility_rent'): string {
  const kindLabel = expenseKind === 'subscription' ? 'suscripción' : 'gasto fijo'
  return `Listo ✅ Cargué ${kindLabel} "${description}" por ${formatArs(amount)}/mes. Se agrega como gasto fijo mensual.`
}

export function buildSavingsGoalConfirmedReply(name: string, targetAmount: number): string {
  return `Listo ✅ Creé la meta "${name}" con objetivo ${formatArs(targetAmount)}. Podés sumarle plata desde la app en Metas de Ahorro.`
}

/**
 * Confirmación de un pago/cobro de deuda. `remainingAfter` es el saldo
 * que queda tras el pago: si es 0, la deuda quedó totalmente saldada.
 */
export function buildDebtPaymentConfirmedReply(
  paymentType: 'pay' | 'collect',
  amount: number,
  personName: string,
  remainingAfter: number,
  currency: string
): string {
  const action =
    paymentType === 'pay'
      ? `Registré un pago de ${formatMoney(amount, currency)} a ${personName}`
      : `Registré que cobraste ${formatMoney(amount, currency)} de ${personName}`
  const remaining = remainingAfter <= 0
    ? 'La deuda quedó totalmente saldada.'
    : `Quedan ${formatMoney(remainingAfter, currency)} de deuda.`
  const movement = paymentType === 'pay' ? 'Lo sumé a tus Gastos.' : 'Lo sumé a tus Ingresos.'
  return `Listo ✅ ${action}. ${remaining} ${movement}`
}

export function buildDebtPaymentNotFoundReply(personName: string): string {
  return `No encontré una deuda con ${personName}. Registrala con algo tipo "Debo 5000 a Juan" o desde la app (Deudas), y volvé a intentar.`
}

export function buildRecurringPaymentConfirmedReply(serviceName: string, amount: number, currency: string): string {
  return `Listo ✅ Registré el pago de ${formatMoney(amount, currency)} del servicio "${serviceName}" y lo sumé a tus Gastos.`
}

export function buildRecurringPaymentNotFoundReply(serviceName: string): string {
  return `No encontré un servicio llamado "${serviceName}". Registralo con algo tipo "Suscripción 5000 Netflix" o desde la app (Suscripciones), y volvé a intentar.`
}

/**
 * Confirmación del pago de una cuota de una compra en cuotas. Si
 * `fullyPaid` es true, la compra quedó totalmente pagada.
 */
export function buildInstallmentPaymentConfirmedReply(
  description: string,
  installmentNumber: number,
  installmentsCount: number,
  amount: number,
  fullyPaid: boolean
): string {
  const base = `Listo ✅ Registré el pago de la cuota ${installmentNumber}/${installmentsCount} de "${description}" (${formatArs(amount)}) y lo sumé a tus Gastos.`
  return fullyPaid ? `${base} La compra quedó totalmente pagada.` : base
}

export function buildInstallmentPaymentNotFoundReply(purchaseName: string): string {
  return `No encontré una compra en cuotas llamada "${purchaseName}". Registrala con algo tipo "Heladera 200000 en 12 cuotas" o desde la app (Cuotas), y volvé a intentar.`
}

export function buildInstallmentPaymentAlreadyPaidReply(description: string, installmentsCount: number): string {
  return `"${description}" ya está totalmente pagada (${installmentsCount}/${installmentsCount}). No queda ninguna cuota por pagar.`
}

export function buildSaveErrorReply(): string {
  return 'Hubo un error registrando eso. Probá de nuevo.'
}

export function buildScoreReply(result: FinancialHealthResult, noData: boolean): string {
  if (noData) {
    return 'Todavía no cargaste ningún ingreso ni gasto este mes — así que no hay Score para calcular. Cargá movimientos desde la app y volvé a preguntarme /score.'
  }
  const { savings, debt, emergencyFund, antExpenses } = result.pillars
  const emojiFor = (score: number) => (score < 40 ? '⛔' : score < 70 ? '⚠️' : '✅')
  return [
    `Tu Un Mango Score es ${result.totalScore}/100.`,
    '',
    `${emojiFor(savings.score)} Ahorro: ${savings.score}/100`,
    `${emojiFor(debt.score)} Deuda: ${debt.score}/100`,
    `${emojiFor(emergencyFund.score)} Fondo de Emergencia: ${emergencyFund.score}/100`,
    `${emojiFor(antExpenses.score)} Gasto Hormiga: ${antExpenses.score}/100`,
    '',
    'Cada pilar vale un cuarto del Score. Mandame /consejos para ver qué mejorar.',
  ].join('\n')
}

export function buildDebtsReply(items: DebtListItem[]): string {
  if (items.length === 0) {
    return 'No tenés deudas cargadas. Mandame algo tipo "Debo 5000 a Juan" para registrar una.'
  }
  const lines = items.map((d) => {
    const base =
      d.debtType === 'debo'
        ? `A ${d.counterpartyName}: le debés ${formatMoney(d.totalAmount, d.currency)}`
        : `${d.counterpartyName}: te debe ${formatMoney(d.totalAmount, d.currency)}`
    const pending = d.remainingAmount > 0 && d.remainingAmount !== d.totalAmount ? ` (quedan ${formatMoney(d.remainingAmount, d.currency)})` : ''
    return `• ${base}${pending}`
  })
  return ['Tus deudas:', ...lines].join('\n')
}

export function buildCuotasReply(items: InstallmentListItem[]): string {
  if (items.length === 0) {
    return 'No tenés compras en cuotas. Mandame algo tipo "Heladera 200000 en 12 cuotas" para registrar una.'
  }
  const lines = items.map((p) => {
    const progress = p.paidCount > 0 ? ` (pagadas ${p.paidCount}/${p.installmentsCount})` : ''
    return `• ${p.description} — ${formatArs(p.totalAmount)} en ${p.installmentsCount} cuotas de ${formatArs(p.monthlyAmount)}${progress}`
  })
  return ['Tus compras en cuotas:', ...lines].join('\n')
}

export function buildMetasReply(items: GoalListItem[]): string {
  if (items.length === 0) {
    return 'No tenés metas de ahorro. Mandame algo tipo "Meta Vacaciones 200000" para crear una.'
  }
  const lines = items.map((g) => {
    const progress = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0
    const contribution = g.monthlyContribution > 0 ? `, aportando ${formatArs(g.monthlyContribution)}/mes` : ''
    return `• ${g.name} — ${formatArs(g.currentAmount)} de ${formatArs(g.targetAmount)} (${progress}%)${contribution}`
  })
  return ['Tus metas de ahorro:', ...lines].join('\n')
}

export function buildFijosReply(items: RecurringListItem[]): string {
  if (items.length === 0) {
    return 'No tenés suscripciones ni gastos fijos activos. Mandame algo tipo "Suscripción 5000 Netflix" o "Alquiler 20000" para cargar uno.'
  }
  const lines = items.map((r) => {
    const kindLabel = r.expenseKind === 'subscription' ? 'Suscripción' : 'Gasto fijo'
    const freq = r.billingFrequency === 'annual' ? ' (anual)' : ''
    const day = r.billingDay ? `, vence el ${r.billingDay}` : ''
    return `• ${r.title} — ${formatMoney(r.amount, r.currency)}${freq}${day} [${kindLabel}]`
  })
  return ['Tus suscripciones y gastos fijos:', ...lines].join('\n')
}

export function buildConsejosReply(messages: string[], noData: boolean): string {
  if (noData) {
    return 'Todavía no hay nada cargado este mes, así que no hay mucho para recomendar — cargá tu primer ingreso o gasto y los consejos se arman solos.'
  }
  if (messages.length === 0) {
    return 'Por ahora no hay ninguna alerta puntual — tus números están en un rango razonable en los 4 pilares del Un Mango Score.'
  }
  return ['Tus recomendaciones:', '', ...messages].join('\n')
}

export function buildHogarReply(balance: HouseholdBalance | null, unsettledDays: number | null): string {
  if (balance === null) {
    return 'Todavía no vinculaste el Modo Hogar. Generá un código de invitación desde la app (Configuración → Modo Hogar) y vinculá a tu pareja para llevar los gastos de la casa.'
  }
  const lines: string[] = []
  if (balance.netBalanceForMe === 0) {
    lines.push('Están a mano — pagaron lo mismo en gastos de hogar.')
  } else if (balance.netBalanceForMe > 0) {
    lines.push(`Tu pareja te debe ${formatArs(balance.netBalanceForMe)} por los gastos de hogar.`)
  } else {
    lines.push(`Le debés a tu pareja ${formatArs(Math.abs(balance.netBalanceForMe))} por los gastos de hogar.`)
  }
  if (balance.totalHouseholdExpenses > 0) {
    lines.push(
      `Gastos de la casa: ${formatArs(balance.totalHouseholdExpenses)} (vos ${formatArs(balance.totalPaidByMe)}, tu pareja ${formatArs(balance.totalPaidByPartner)}).`
    )
  }
  if (unsettledDays !== null && unsettledDays >= 30) {
    lines.push(`Hace ${unsettledDays} días que está sin saldar — puede ser buen momento para arreglar cuentas.`)
  }
  return lines.join('\n')
}

// ---------------- Billeteras (replica de get_wallet_balances, wallets.sql) ----------------

const WALLET_TYPE_LABELS: Record<string, string> = {
  virtual_wallet: 'Billetera Virtual',
  bank: 'Banco',
  cash: 'Efectivo',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
  other: 'Otra',
}

export interface WalletBalanceRow {
  name: string
  type: string
  /** Saldo en ARS (saldo inicial + ingresos vinculados - gastos vinculados). */
  balance: number
  /** Suma de amount_usd de las transacciones en dólares vinculadas (informativo). */
  usdHeld: number
  /** TNA en % con la que rinde la billetera (null/0 si no rinde). */
  tnaPercentage?: number | null
}

/**
 * Replica de get_wallet_balances() (wallets.sql): saldo por billetera =
 * saldo inicial + ingresos vinculados - gastos vinculados, todo en ARS
 * (amount_ars). Las transacciones sin billetera (wallet_id null, las
 * viejas) no afectan ningún saldo — igual que en la app. Además suma el
 * USD de las transacciones en dólares vinculadas para mostrarlo aparte.
 */
export function computeWalletBalances(
  wallets: { id: string; name: string; type: string; initialBalance: number; tna?: number | null }[],
  transactions: { walletId: string | null; type: string; amountArs: number; isUsd: boolean; amountUsd: number | null }[]
): WalletBalanceRow[] {
  return wallets.map((w) => {
    const linked = transactions.filter((t) => t.walletId === w.id)
    const balance = linked.reduce(
      (acc, t) => acc + (t.type === 'income' ? t.amountArs : -t.amountArs),
      w.initialBalance
    )
    const usdHeld = linked
      .filter((t) => t.isUsd)
      .reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0)
    return { name: w.name, type: w.type, balance, usdHeld, tnaPercentage: w.tna ?? null }
  })
}

export function buildBilleterasReply(items: WalletBalanceRow[]): string {
  if (items.length === 0) {
    return 'Todavía no creaste ninguna billetera. Creá una desde la app (Billeteras) y volvé a preguntarme /billeteras.'
  }
  const lines = items.map((w) => {
    const label = WALLET_TYPE_LABELS[w.type] ?? w.type
    const usd = w.usdHeld > 0 ? ` (+ ${formatMoney(w.usdHeld, 'USD')})` : ''
    const tna = w.tnaPercentage ?? null
    const yieldSuffix =
      tna && tna > 0 ? ` (TNA ${tna}% → +${formatArs(walletDailyYield(w.balance, tna))}/día)` : ''
    return `• ${w.name} — ${formatArs(w.balance)}${yieldSuffix}${usd} [${label}]`
  })
  const total = items.reduce((acc, w) => acc + w.balance, 0)
  const totalDaily = round2(items.reduce((acc, w) => acc + walletDailyYield(w.balance, w.tnaPercentage ?? 0), 0))
  const reply = ['Tus billeteras:', ...lines, '', `Total: ${formatArs(total)}`]
  if (totalDaily > 0) {
    reply.push(`Renta diaria total estimada: ${formatArs(totalDaily)}/día`)
  }
  return reply.join('\n')
}

// ---------------- Vencimientos próximos (replicas de recurringBilling / installments / debts) ----------------

export type DueKind = 'fijo' | 'cuota' | 'deuda'

/**
 * A qué apunta el botón "Marcar Pagada" de un ítem: la deuda entera
 * (pay_debt:[id]) o una cuota puntual de una compra
 * (pay_installment:[id]:[número]).
 */
export type DuePaymentTarget =
  | { kind: 'debt'; debtId: string }
  | { kind: 'installment'; purchaseId: string; installmentNumber: number }

export interface DueItem {
  description: string
  /** Fecha de vencimiento en formato YYYY-MM-DD. */
  dueDate: string
  amount: number
  currency: string
  kind: DueKind
  /** Detalle opcional, ej. "cuota 3/12". */
  detail?: string
  /** Botón inline de pago, presente solo cuando el ítem es pagable. */
  paymentTarget?: DuePaymentTarget
}

/** Ventana por defecto de /vencimientos: lo que vence de hoy a 30 días. */
export const UPCOMING_WINDOW_DAYS = 30

export interface UpcomingDueInput {
  recurring: {
    title: string
    amount: number
    currency: string
    billingDay: number
    billingFrequency: BillingFrequency
    billingMonth: number | null
  }[]
  installments: {
    /** ID de la compra, para armar el botón de pago de la cuota. */
    id?: string
    description: string
    totalAmount: number
    installmentsCount: number
    firstInstallmentDate: string
    paidInstallmentNumbers: number[]
  }[]
  debts: {
    /** ID de la deuda, para armar el botón de pago. */
    id?: string
    description: string
    remainingAmount: number
    currency: string
    dueDate: string | null
    debtType: 'debo' | 'me_deben'
  }[]
  today?: Date
  windowDays?: number
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (1000 * 60 * 60 * 24))
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clampToLastDayOfMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

/**
 * Próxima fecha de facturación de un gasto recurrente — replica
 * src/lib/recurringBilling.ts (daysUntilNextBilling), pero devolviendo
 * la fecha en vez de los días que faltan.
 */
export function nextBillingDate(
  billingDay: number,
  frequency: BillingFrequency = 'monthly',
  billingMonth: number | null = null,
  today: Date = new Date()
): Date {
  const start = startOfDay(today)

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

export interface InstallmentScheduleItem {
  installmentNumber: number
  dueDate: Date
  amount: number
}

/**
 * Plan de cuotas — replica src/lib/installments.ts (computeInstallmentSchedule):
 * cuotas mensuales desde la primera fecha, con el resto del redondeo en
 * la última para que la suma dé exactamente el total.
 */
export function computeInstallmentScheduleItems(
  totalAmount: number,
  installmentsCount: number,
  firstInstallmentDate: Date
): InstallmentScheduleItem[] {
  if (installmentsCount <= 0) return []

  const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100
  const schedule: InstallmentScheduleItem[] = []
  let accumulated = 0

  for (let i = 1; i <= installmentsCount; i++) {
    const isLast = i === installmentsCount
    const amount = isLast ? Math.round((totalAmount - accumulated) * 100) / 100 : baseAmount
    accumulated += amount

    const dueDate = new Date(firstInstallmentDate)
    dueDate.setMonth(dueDate.getMonth() + (i - 1))

    schedule.push({ installmentNumber: i, dueDate, amount })
  }

  return schedule
}

/**
 * Consolida los vencimientos que caen dentro de la ventana (de hoy a
 * windowDays) y los ordena por fecha:
 * - fijos recurrentes activos: su próxima facturación.
 * - cuotas impagas: las cuotas que vencen en la ventana.
 * - deudas tipo "debo" con fecha de vencimiento: solo las que vencen.
 */
export function computeUpcomingDueItems(input: UpcomingDueInput): DueItem[] {
  const today = startOfDay(input.today ?? new Date())
  const windowDays = input.windowDays ?? UPCOMING_WINDOW_DAYS
  const items: DueItem[] = []

  for (const r of input.recurring) {
    const next = nextBillingDate(r.billingDay, r.billingFrequency, r.billingMonth, today)
    const days = daysBetween(today, next)
    if (days >= 0 && days <= windowDays) {
      items.push({
        description: r.title,
        dueDate: toIsoDate(next),
        amount: r.amount,
        currency: r.currency,
        kind: 'fijo',
      })
    }
  }

  for (const p of input.installments) {
    const first = new Date(`${p.firstInstallmentDate}T00:00:00`)
    const schedule = computeInstallmentScheduleItems(p.totalAmount, p.installmentsCount, first)
    const paid = new Set(p.paidInstallmentNumbers)
    for (const item of schedule) {
      if (paid.has(item.installmentNumber)) continue
      const days = daysBetween(today, item.dueDate)
      if (days >= 0 && days <= windowDays) {
        items.push({
          description: p.description,
          dueDate: toIsoDate(item.dueDate),
          amount: item.amount,
          currency: 'ARS',
          kind: 'cuota',
          detail: `cuota ${item.installmentNumber}/${p.installmentsCount}`,
          paymentTarget: p.id
            ? { kind: 'installment', purchaseId: p.id, installmentNumber: item.installmentNumber }
            : undefined,
        })
      }
    }
  }

  for (const d of input.debts) {
    if (d.debtType !== 'debo' || d.remainingAmount <= 0 || !d.dueDate) continue
    const days = daysBetween(today, new Date(`${d.dueDate}T00:00:00`))
    if (days >= 0 && days <= windowDays) {
      items.push({
        description: d.description,
        dueDate: d.dueDate,
        amount: d.remainingAmount,
        currency: d.currency,
        kind: 'deuda',
        paymentTarget: d.id ? { kind: 'debt', debtId: d.id } : undefined,
      })
    }
  }

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function formatDateShort(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

export function buildVencimientosReply(items: DueItem[], windowDays: number = UPCOMING_WINDOW_DAYS): string {
  if (items.length === 0) {
    return `No tenés vencimientos en los próximos ${windowDays} días.`
  }

  const lines = items.map((item) => {
    const kindLabel = item.kind === 'fijo' ? 'fijo' : item.kind === 'cuota' ? 'cuota' : 'deuda'
    const detail = item.detail ? `, ${item.detail}` : ''
    return `• ${formatDateShort(item.dueDate)} — ${item.description}${detail} — ${formatMoney(item.amount, item.currency)} [${kindLabel}]`
  })

  const totalArs = items.filter((i) => i.currency !== 'USD').reduce((acc, i) => acc + i.amount, 0)
  const totalUsd = items.filter((i) => i.currency === 'USD').reduce((acc, i) => acc + i.amount, 0)

  const totalLines = [`Total a pagar: ${formatArs(totalArs)}`]
  if (totalUsd > 0) totalLines.push(` + ${formatMoney(totalUsd, 'USD')}`)

  return [`Tus próximos vencimientos (${windowDays} días):`, ...lines, '', ...totalLines].join('\n')
}

// ---------------- Payloads con botones inline ----------------

/**
 * Payload de /deudas: el texto de buildDebtsReply más un botón inline
 * "✅ Marcar Pagada" por cada deuda "debo" pendiente (pay_debt:[id]).
 */
export function buildDebtsPayload(items: DebtListItem[]): TelegramReplyPayload {
  const text = buildDebtsReply(items)
  const rows = items
    .filter((d) => d.debtType === 'debo' && d.remainingAmount > 0 && !!d.id)
    .map((d) => [buildPayButton(`pay_debt:${d.id}`)])
  return { text, replyMarkup: rows.length > 0 ? { inline_keyboard: rows } : null }
}

/**
 * Payload de /cuotas: el texto de buildCuotasReply más un botón inline
 * por cada compra con cuotas impagas (pay_installment:[id]) que paga la
 * próxima cuota impaga del plan.
 */
export function buildCuotasPayload(items: InstallmentListItem[]): TelegramReplyPayload {
  const text = buildCuotasReply(items)
  const rows = items
    .filter((p) => !!p.id && p.paidCount < p.installmentsCount)
    .map((p) => [buildPayButton(`pay_installment:${p.id}`)])
  return { text, replyMarkup: rows.length > 0 ? { inline_keyboard: rows } : null }
}

/**
 * Payload de /vencimientos: el texto de buildVencimientosReply más un
 * botón inline por cada ítem pagable — cuota (pay_installment:[id]:[n])
 * o deuda (pay_debt:[id]).
 */
export function buildVencimientosPayload(items: DueItem[]): TelegramReplyPayload {
  const text = buildVencimientosReply(items)
  const rows = items
    .filter((i) => i.paymentTarget)
    .map((i) => {
      const target = i.paymentTarget as DuePaymentTarget
      const callbackData =
        target.kind === 'debt'
          ? `pay_debt:${target.debtId}`
          : `pay_installment:${target.purchaseId}:${target.installmentNumber}`
      return [buildPayButton(callbackData)]
    })
  return { text, replyMarkup: rows.length > 0 ? { inline_keyboard: rows } : null }
}

// ---------------- Resumen visual con QuickChart ----------------

export interface ExpenseCategorySlice {
  label: string
  value: number
}

/**
 * Agrupa los gastos del mes por categoría (sumando los montos) y los
 * ordena de mayor a menor. Los gastos sin categoría van a "Sin
 * categoría"; los ingresos no se cuentan.
 */
export function buildExpenseCategorySlices(
  transactions: { type: string; amountArs: number; categoryName: string | null }[]
): ExpenseCategorySlice[] {
  const byLabel = new Map<string, number>()
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const amount = Number(t.amountArs) || 0
    if (amount <= 0) continue
    const label = t.categoryName?.trim() || 'Sin categoría'
    byLabel.set(label, (byLabel.get(label) ?? 0) + amount)
  }
  return [...byLabel.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

const CHART_COLOR_PALETTE = [
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
]

/**
 * URL de QuickChart (Chart.js as Image) con un gráfico de torta
 * (doughnut) de la distribución de gastos por categoría. QuickChart
 * renderiza la imagen al pedir la URL.
 */
export function buildQuickChartPieUrl(slices: ExpenseCategorySlice[]): string {
  const config = {
    type: 'doughnut',
    data: {
      labels: slices.map((s) => s.label),
      datasets: [
        {
          data: slices.map((s) => s.value),
          backgroundColor: slices.map((_, i) => CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length]),
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: 'Gastos del mes por categoría' },
      },
    },
  }
  const encoded = encodeURIComponent(JSON.stringify(config))
  return `https://quickchart.io/chart?c=${encoded}&width=520&height=320`
}

/**
 * Caption del gráfico de /resumen: desglose por categoría con el total
 * del mes y (si hay ingreso cargado) el porcentaje que representa.
 */
export function buildResumenCaption(
  slices: ExpenseCategorySlice[],
  monthlyExpense: number,
  monthlyIncome: number
): string {
  const lines = slices.map((s) => `• ${s.label}: ${formatArs(s.value)}`)
  const header = `📊 Tus gastos de ${formatArs(monthlyExpense)} este mes, por categoría:`
  const footer =
    monthlyIncome > 0
      ? `Representan el ${Math.round((monthlyExpense / monthlyIncome) * 100)}% de tu ingreso (${formatArs(monthlyIncome)}).`
      : 'Cargá tu ingreso mensual en la app para ver el porcentaje que representan.'
  return [header, '', ...lines, '', footer].join('\n')
}
