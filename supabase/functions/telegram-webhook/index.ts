// Edge Function: telegram-webhook
//
// Qué hace: recibe los mensajes que le llegan al bot de Telegram
// (webhook configurado con setWebhook, ver README.md). Casos:
//
// 1. Comandos (/saldo, /gastado, /safetospend, /score, /deudas, /cuotas,
//    /metas, /fijos, /consejos, /hogar, /ayuda) — si el chat ya está
//    vinculado, consulta los datos del usuario y responde.
// 2. Código de vinculación de 6 dígitos (con o sin "/start" adelante) —
//    busca ese código en telegram_links y completa el telegram_chat_id.
// 3. Cualquier otro mensaje con una intención reconocible (ej. "Gasto 4500
//    café", "Debo 5000 a Juan", "Pagué 5000 a Juan", "Pago servicio
//    Netflix 5000", "Pago 1 cuota Heladera", "Heladera 200000 en 12 cuotas",
//    "Suscripción 5000 Netflix", "Meta Vacaciones 200000") — si el chat_id
//    ya está vinculado, inserta la entidad correspondiente (transacción,
//    deuda, pago de deuda con movimiento, pago de servicio con movimiento,
//    pago de cuota con movimiento, compra en cuotas, gasto fijo o meta de
//    ahorro) para ese usuario.
//
// En todos los casos responde al usuario por Telegram confirmando qué se
// hizo (o el error), para que no quede la duda de si funcionó.
//
// Variables de entorno necesarias (ver README.md para el paso a paso):
//   TELEGRAM_BOT_TOKEN   — el token que te da BotFather
//   TELEGRAM_WEBHOOK_SECRET — secreto que vos elegís, para validar que
//                             la request realmente viene de Telegram
//                             (Telegram lo manda de vuelta en el header
//                             X-Telegram-Bot-Api-Secret-Token si lo
//                             configurás en setWebhook)
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase
// automáticamente en toda Edge Function.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { parseTelegramMessage } from './message-parser.ts'
import {
  buildBilleterasReply,
  buildConsejosReply,
  buildCuotasReply,
  buildDebtConfirmedReply,
  buildDebtPaymentConfirmedReply,
  buildDebtPaymentNotFoundReply,
  buildDebtsReply,
  buildExpenseConfirmedReply,
  buildExpenseErrorReply,
  buildFijosReply,
  buildGastadoReply,
  buildHelpReply,
  buildHogarReply,
  buildInstallmentConfirmedReply,
  buildInstallmentPaymentAlreadyPaidReply,
  buildInstallmentPaymentConfirmedReply,
  buildInstallmentPaymentNotFoundReply,
  buildLinkErrorReply,
  buildLinkInvalidReply,
  buildLinkSuccessReply,
  buildMetasReply,
  buildNotLinkedReply,
  buildRecurringConfirmedReply,
  buildRecurringPaymentConfirmedReply,
  buildRecurringPaymentNotFoundReply,
  buildSafeToSpendReply,
  buildSaldoReply,
  buildSaveErrorReply,
  buildSavingsGoalConfirmedReply,
  buildScoreReply,
  buildUnknownCommandReply,
  buildUnrecognizedReply,
  buildVencimientosReply,
  computeFinancialHealthScore,
  computeHouseholdBalance,
  computeInstallmentScheduleItems,
  computeSafeToSpend,
  computeStreakBreak,
  computeUpcomingDueItems,
  computeWalletBalances,
  detectAntExpenses,
  generateAdviceMessages,
  getDaysRemainingInMonth,
  hasNoFinancialData,
  isGoalStalled,
  monthlyEquivalentAmount,
} from './reply-builder.ts'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Telegram respondió ${res.status} al enviar el mensaje: ${body}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Error de red al enviar mensaje a Telegram:', err)
    return false
  }
}

interface FinancialSummary {
  totalBalance: number
  monthlyExpense: number
  monthlyIncome: number
  walletCount: number
  /** Montos de los gastos del mes (para gastos hormiga). */
  monthlyExpenseAmounts: number[]
  /** Días del mes (1-31) en los que hubo al menos un gasto (para la racha). */
  monthlyExpenseDays: number[]
}

// El bot usa la service role key (no hay sesión de usuario en un
// webhook), así que consulta las tablas directo por user_id en vez de
// las RPCs del frontend (que filtran por auth.uid()).
async function fetchFinancialSummary(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<FinancialSummary> {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime()

  const [walletsResult, transactionsResult] = await Promise.all([
    supabase.from('wallets').select('initial_balance').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('amount_ars, type, created_at')
      .eq('user_id', userId),
  ])

  if (walletsResult.error || transactionsResult.error) {
    throw walletsResult.error || transactionsResult.error
  }

  const initial = (walletsResult.data ?? []).reduce((acc, w) => acc + (Number(w.initial_balance) || 0), 0)
  const transactions = transactionsResult.data ?? []

  let totalIncome = 0
  let totalExpense = 0
  let monthlyExpense = 0
  let monthlyIncome = 0
  const monthlyExpenseAmounts: number[] = []
  const monthlyExpenseDays: number[] = []

  for (const t of transactions) {
    const amount = Number(t.amount_ars) || 0
    if (t.type === 'income') {
      totalIncome += amount
      if (t.created_at && new Date(t.created_at).getTime() >= monthStart) monthlyIncome += amount
    } else {
      totalExpense += amount
      if (t.created_at && new Date(t.created_at).getTime() >= monthStart) {
        monthlyExpense += amount
        monthlyExpenseAmounts.push(amount)
        monthlyExpenseDays.push(new Date(t.created_at).getDate())
      }
    }
  }

  return {
    totalBalance: initial + totalIncome - totalExpense,
    monthlyExpense,
    monthlyIncome,
    walletCount: walletsResult.data?.length ?? 0,
    monthlyExpenseAmounts,
    monthlyExpenseDays,
  }
}

interface SafeToSpendData {
  monthlyFixedCommitments: number
  budgetedAllocations: number
  savingsContributions: number
  installmentCommitments: number
}

async function fetchSafeToSpendData(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<SafeToSpendData> {
  const [recurring, budgets, goals, installments] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('amount, currency, billing_frequency')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase.from('budgets').select('monthly_limit').eq('user_id', userId),
    supabase.from('savings_goals').select('monthly_contribution').eq('user_id', userId),
    supabase
      .from('installment_purchases')
      .select('total_amount, installments_count')
      .eq('user_id', userId),
  ])

  for (const r of [recurring, budgets, goals, installments]) {
    if (r.error) throw r.error
  }

  return {
    // Mismo criterio que "Fijo Comprometido": solo ARS, prorrateando las
    // anuales a su equivalente mensual.
    monthlyFixedCommitments: (recurring.data ?? []).reduce(
      (acc, r) => acc + (r.currency === 'ARS' ? monthlyEquivalentAmount(Number(r.amount), r.billing_frequency) : 0),
      0
    ),
    budgetedAllocations: (budgets.data ?? []).reduce((acc, b) => acc + (Number(b.monthly_limit) || 0), 0),
    savingsContributions: (goals.data ?? []).reduce((acc, g) => acc + (Number(g.monthly_contribution) || 0), 0),
    installmentCommitments: (installments.data ?? []).reduce(
      (acc, p) => acc + (p.installments_count > 0 ? Number(p.total_amount) / p.installments_count : 0),
      0
    ),
  }
}

interface HouseholdData {
  balance: ReturnType<typeof computeHouseholdBalance> | null
  /** Días sin saldar (desde el gasto más viejo) si el balance no está a mano. */
  unsettledDays: number | null
}

async function fetchHouseholdData(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  now: Date = new Date()
): Promise<HouseholdData> {
  const { data: link, error: linkError } = await supabase
    .from('household_links')
    .select('id')
    .eq('status', 'active')
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle()

  if (linkError) throw linkError
  if (!link) return { balance: null, unsettledDays: null }

  const { data: expenses, error: expensesError } = await supabase
    .from('household_expenses')
    .select('amount, paid_by_user_id, created_at')
    .eq('household_id', link.id)
    .order('created_at', { ascending: true })

  if (expensesError) throw expensesError

  const rows = expenses ?? []
  const totalPaidByMe = rows
    .filter((e) => e.paid_by_user_id === userId)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
  const totalPaidByPartner = rows
    .filter((e) => e.paid_by_user_id !== userId)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0)

  const balance = computeHouseholdBalance(totalPaidByMe, totalPaidByPartner)

  let unsettledDays: number | null = null
  if (balance.netBalanceForMe !== 0 && rows.length > 0) {
    const oldest = new Date(rows[0].created_at)
    unsettledDays = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
  }

  return { balance, unsettledDays }
}

// Saldo por billetera, replicando get_wallet_balances() pero con
// consultas directas por user_id (la RPC filtra por auth.uid()).
async function fetchWalletBalances(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ReturnType<typeof computeWalletBalances>> {
  const [walletsResult, transactionsResult] = await Promise.all([
    supabase
      .from('wallets')
      .select('id, name, type, initial_balance')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('wallet_id, type, amount_ars, is_usd, amount_usd')
      .eq('user_id', userId),
  ])

  if (walletsResult.error || transactionsResult.error) {
    throw walletsResult.error || transactionsResult.error
  }

  return computeWalletBalances(
    (walletsResult.data ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      initialBalance: Number(w.initial_balance) || 0,
    })),
    (transactionsResult.data ?? []).map((t) => ({
      walletId: t.wallet_id,
      type: t.type,
      amountArs: Number(t.amount_ars) || 0,
      isUsd: t.is_usd,
      amountUsd: t.amount_usd !== null ? Number(t.amount_usd) : null,
    }))
  )
}

// Vencimientos próximos: fijos activos, cuotas impagas y deudas "debo"
// con fecha — todo dentro de la ventana de 30 días (UPCOMING_WINDOW_DAYS).
async function fetchUpcomingDueItems(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ReturnType<typeof computeUpcomingDueItems>> {
  const [recurring, purchases, payments, debts] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('title, amount, currency, billing_day, billing_frequency, billing_month')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('installment_purchases')
      .select('id, description, total_amount, installments_count, first_installment_date')
      .eq('user_id', userId),
    supabase
      .from('installment_payments')
      .select('installment_purchase_id, installment_number')
      .eq('user_id', userId),
    supabase
      .from('debts')
      .select('description, remaining_amount, currency, due_date, debt_type')
      .eq('user_id', userId),
  ])

  for (const r of [recurring, purchases, payments, debts]) {
    if (r.error) throw r.error
  }

  const paidByPurchase = new Map<string, number[]>()
  for (const p of payments.data ?? []) {
    const list = paidByPurchase.get(p.installment_purchase_id) ?? []
    list.push(p.installment_number)
    paidByPurchase.set(p.installment_purchase_id, list)
  }

  return computeUpcomingDueItems({
    recurring: (recurring.data ?? []).map((r) => ({
      title: r.title,
      amount: Number(r.amount) || 0,
      currency: r.currency,
      billingDay: r.billing_day,
      billingFrequency: r.billing_frequency,
      billingMonth: r.billing_month,
    })),
    installments: (purchases.data ?? []).map((p) => ({
      description: p.description,
      totalAmount: Number(p.total_amount) || 0,
      installmentsCount: p.installments_count,
      firstInstallmentDate: p.first_installment_date,
      paidInstallmentNumbers: paidByPurchase.get(p.id) ?? [],
    })),
    debts: (debts.data ?? []).map((d) => ({
      description: d.description,
      remainingAmount: Number(d.remaining_amount) || 0,
      currency: d.currency,
      dueDate: d.due_date,
      debtType: d.debt_type,
    })),
  })
}

// Registra un pago de deuda: descuenta el monto del saldo pendiente,
// crea el movimiento real (gasto si pagás, ingreso si cobrás) y guarda
// el pago en debt_payments — mismo flujo que DebtsManager del frontend.
async function handleDebtPayment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  personName: string,
  paymentType: 'pay' | 'collect'
): Promise<{ found: boolean; reply: string }> {
  const searchName = personName.replace(/[%_]/g, '').trim()
  const { data, error } = await supabase
    .from('debts')
    .select('id, description, counterparty_name, debt_type, currency, remaining_amount')
    .eq('user_id', userId)
    .ilike('counterparty_name', `%${searchName}%`)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = data ?? []
  // Preferimos una deuda pendiente coherente con la intención: pagar va
  // contra deudas "debo" y cobrar contra "me_deben".
  const typeWanted = paymentType === 'pay' ? 'debo' : 'me_deben'
  const debt =
    rows.find((d) => Number(d.remaining_amount) > 0 && d.debt_type === typeWanted) ??
    rows.find((d) => Number(d.remaining_amount) > 0) ??
    rows[0]

  if (!debt) {
    return { found: false, reply: buildDebtPaymentNotFoundReply(personName) }
  }

  const newRemaining = Math.max(0, Number(debt.remaining_amount) - amount)

  const { error: updateError } = await supabase
    .from('debts')
    .update({ remaining_amount: newRemaining })
    .eq('id', debt.id)
  if (updateError) throw updateError

  const isUsd = debt.currency === 'USD'
  const description =
    paymentType === 'pay'
      ? `Pago de deuda a ${debt.counterparty_name}`
      : `Cobro de deuda de ${debt.counterparty_name}`

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert([
      {
        user_id: userId,
        type: paymentType === 'pay' ? 'expense' : 'income',
        description,
        payment_method: 'Otro (Telegram)',
        is_usd: isUsd,
        amount_usd: isUsd ? amount : null,
        amount_ars: amount,
        exchange_rate: null,
        category_id: null,
      },
    ])
    .select('id')
    .single()
  if (txError) throw txError

  const { error: paymentError } = await supabase.from('debt_payments').insert([
    { debt_id: debt.id, user_id: userId, amount, transaction_id: txData.id },
  ])
  if (paymentError) throw paymentError

  return {
    found: true,
    reply: buildDebtPaymentConfirmedReply(paymentType, amount, debt.counterparty_name, newRemaining, debt.currency),
  }
}

// Registra el pago de un servicio/suscripción existente: busca por
// nombre, crea el movimiento (gasto) con la categoría del servicio —
// igual que el botón "Pagar" de RecurringManager del frontend.
async function handleRecurringPayment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amount: number,
  serviceName: string
): Promise<{ found: boolean; reply: string }> {
  const searchName = serviceName.replace(/[%_]/g, '').trim()
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select('id, title, category_id, currency')
    .eq('user_id', userId)
    .eq('is_active', true)
    .ilike('title', `%${searchName}%`)
    .order('created_at', { ascending: false })
  if (error) throw error

  const service = (data ?? [])[0]
  if (!service) {
    return { found: false, reply: buildRecurringPaymentNotFoundReply(serviceName) }
  }

  const { error: txError } = await supabase.from('transactions').insert([
    {
      user_id: userId,
      type: 'expense',
      description: `Pago servicio ${service.title}`,
      payment_method: 'Otro (Telegram)',
      is_usd: false,
      amount_usd: null,
      amount_ars: amount,
      exchange_rate: null,
      category_id: service.category_id ?? null,
    },
  ])
  if (txError) throw txError

  return { found: true, reply: buildRecurringPaymentConfirmedReply(service.title, amount, 'ARS') }
}

// Registra el pago de una cuota de una compra en cuotas existente: busca
// la compra por descripción, marca la cuota como pagada (mismo mecanismo
// que el botón "Pagar cuota" de InstallmentTracker: un registro en
// installment_payments con el número de la cuota, sin superar el total
// del plan) y crea el movimiento real en transactions.
async function handleInstallmentPayment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  purchaseName: string,
  amount: number | null,
  installmentNumber: number | null
): Promise<{ found: boolean; reply: string }> {
  const searchName = purchaseName.replace(/[%_]/g, '').trim()
  const { data, error } = await supabase
    .from('installment_purchases')
    .select('id, description, total_amount, installments_count, first_installment_date, category_id')
    .eq('user_id', userId)
    .ilike('description', `%${searchName}%`)
    .order('created_at', { ascending: false })
  if (error) throw error

  const purchase = (data ?? [])[0]
  if (!purchase) {
    return { found: false, reply: buildInstallmentPaymentNotFoundReply(purchaseName) }
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('installment_payments')
    .select('installment_number')
    .eq('user_id', userId)
    .eq('installment_purchase_id', purchase.id)
  if (paymentsError) throw paymentsError

  const paidNumbers = new Set((payments ?? []).map((p) => p.installment_number))
  const schedule = computeInstallmentScheduleItems(
    Number(purchase.total_amount) || 0,
    purchase.installments_count,
    new Date(`${purchase.first_installment_date}T00:00:00`)
  )

  // Si viene un número de cuota específico y todavía no está pagada, esa
  // es la que se paga; si no, la próxima impaga del plan.
  let target = schedule.find((item) => !paidNumbers.has(item.installmentNumber))
  if (installmentNumber !== null) {
    const requested = schedule.find((item) => item.installmentNumber === installmentNumber)
    if (requested && !paidNumbers.has(requested.installmentNumber)) target = requested
  }

  if (!target) {
    return { found: true, reply: buildInstallmentPaymentAlreadyPaidReply(purchase.description, purchase.installments_count) }
  }

  const paymentAmount = amount ?? target.amount
  const description = `Pago cuota ${target.installmentNumber}/${purchase.installments_count} - ${purchase.description}`

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .insert([
      {
        user_id: userId,
        type: 'expense',
        description,
        payment_method: 'Otro (Telegram)',
        is_usd: false,
        amount_usd: null,
        amount_ars: paymentAmount,
        exchange_rate: null,
        category_id: purchase.category_id ?? null,
      },
    ])
    .select('id')
    .single()
  if (txError) throw txError

  const { error: paymentError } = await supabase.from('installment_payments').insert([
    {
      installment_purchase_id: purchase.id,
      user_id: userId,
      installment_number: target.installmentNumber,
      transaction_id: txData.id,
    },
  ])
  if (paymentError) throw paymentError

  const fullyPaid = schedule.every(
    (item) => paidNumbers.has(item.installmentNumber) || item.installmentNumber === target?.installmentNumber
  )

  return {
    found: true,
    reply: buildInstallmentPaymentConfirmedReply(
      purchase.description,
      target.installmentNumber,
      purchase.installments_count,
      paymentAmount,
      fullyPaid
    ),
  }
}

interface AdviceData {
  healthScore: ReturnType<typeof computeFinancialHealthScore>
  noData: boolean
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

// Mismos insumos que FinancialAdviceWidget del frontend, pero con
// consultas directas por user_id (las RPCs de la app filtran por
// auth.uid() y no sirven con la service role key).
async function fetchAdviceData(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<AdviceData> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const daysRemaining = getDaysRemainingInMonth(now)

  const [
    summary,
    safeData,
    budgetsResult,
    monthTransactions,
    debtsResult,
    installmentsResult,
    goalsResult,
    categoriesResult,
    priceHistoryResult,
    household,
  ] = await Promise.all([
    fetchFinancialSummary(supabase, userId),
    fetchSafeToSpendData(supabase, userId),
    supabase.from('budgets').select('category_id, monthly_limit, categories(name)').eq('user_id', userId),
    supabase
      .from('transactions')
      .select('category_id, amount_ars, type, created_at')
      .eq('user_id', userId)
      .gte('created_at', monthStart),
    supabase.from('debts').select('interest_rate, remaining_amount, debt_type').eq('user_id', userId),
    supabase
      .from('installment_purchases')
      .select('description, total_amount, installments_count')
      .eq('user_id', userId),
    supabase.from('savings_goals').select('name, current_amount, created_at').eq('user_id', userId),
    supabase.from('categories').select('id').eq('user_id', userId),
    supabase
      .from('recurring_expense_price_history')
      .select('recurring_expense_id, amount, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true }),
    fetchHouseholdData(supabase, userId, now),
  ])

  const results = [
    summary,
    safeData,
    budgetsResult,
    monthTransactions,
    debtsResult,
    installmentsResult,
    goalsResult,
    categoriesResult,
    priceHistoryResult,
    household,
  ]
  for (const r of results) {
    const error = 'error' in r ? r.error : null
    if (error) throw error
  }

  const monthlyIncome = summary.monthlyIncome
  const monthlyExpense = summary.monthlyExpense

  // Presupuestos excedidos: cruzamos el límite de cada categoría con lo
  // gastado este mes (mismo criterio que BudgetManager).
  const spendByCategory = new Map<string, number>()
  for (const t of monthTransactions.data ?? []) {
    if (t.type === 'expense') {
      const key = t.category_id ?? ''
      spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + (Number(t.amount_ars) || 0))
    }
  }
  const exceededBudgetCategoryNames = (budgetsResult.data ?? [])
    .filter((b) => (spendByCategory.get(b.category_id ?? '') ?? 0) > Number(b.monthly_limit))
    .map((b) => (b.categories as { name: string } | null)?.name)
    .filter((name): name is string => !!name)

  const hasHighInterestDebt = (debtsResult.data ?? []).some(
    (d) => d.debt_type === 'debo' && Number(d.remaining_amount) > 0 && Number(d.interest_rate) > 0
  )

  const largeInstallmentDescription =
    monthlyIncome > 0
      ? (installmentsResult.data ?? []).find((p) => Number(p.total_amount) / p.installments_count / monthlyIncome > 0.2)?.description ?? null
      : null

  const stalledGoalNames = (goalsResult.data ?? [])
    .filter((g) => isGoalStalled(Number(g.current_amount), g.created_at, now))
    .map((g) => g.name)

  const hasNoCategories = (categoriesResult.data ?? []).length === 0
  const hasExpensesButNoIncome = monthlyIncome === 0 && monthlyExpense > 0

  // Aumento de suscripción: mismo criterio que detectPriceIncreases —
  // el historial viene ordenado de viejo a nuevo, comparamos los últimos
  // dos snapshots de cada suscripción.
  let hasSubscriptionPriceIncrease = false
  const historyByExpense = new Map<string, number[]>()
  for (const h of priceHistoryResult.data ?? []) {
    const amounts = historyByExpense.get(h.recurring_expense_id) ?? []
    amounts.push(Number(h.amount) || 0)
    historyByExpense.set(h.recurring_expense_id, amounts)
  }
  for (const amounts of historyByExpense.values()) {
    if (amounts.length >= 2) {
      const current = amounts[amounts.length - 1]
      const previous = amounts[amounts.length - 2]
      if (current > previous) {
        hasSubscriptionPriceIncrease = true
        break
      }
    }
  }

  const safeToSpendToday =
    monthlyIncome > 0
      ? computeSafeToSpend({
          totalBalance: summary.totalBalance,
          monthlyFixedCommitments: safeData.monthlyFixedCommitments,
          budgetedAllocations: safeData.budgetedAllocations,
          savingsContributions: safeData.savingsContributions,
          installmentCommitments: safeData.installmentCommitments,
          monthlyIncome,
          daysRemaining,
        }).dailyLimit
      : null

  const antExpensesTotal = detectAntExpenses(
    summary.monthlyExpenseAmounts.map((amount) => ({ amount })),
    3000
  ).total

  const brokenStreakDays = computeStreakBreak(summary.monthlyExpenseDays, now)

  const healthScore = computeFinancialHealthScore({
    monthlyIncome,
    monthlyExpense,
    monthlyDebtPayments: safeData.monthlyFixedCommitments + safeData.installmentCommitments,
    emergencyFundBalance: summary.totalBalance,
    antExpensesTotal,
  })

  return {
    healthScore,
    noData: hasNoFinancialData(monthlyIncome, monthlyExpense),
    safeToSpendToday,
    hasSubscriptionPriceIncrease,
    exceededBudgetCategoryNames,
    hasHighInterestDebt,
    largeInstallmentDescription,
    brokenStreakDays,
    stalledGoalNames,
    hasNoCategories,
    hasExpensesButNoIncome,
    householdUnsettledDays: household.unsettledDays,
  }
}

Deno.serve(async (req: Request) => {
  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  if (webhookSecret) {
    const providedSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (providedSecret !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!botToken) {
    console.error('Falta configurar el secret TELEGRAM_BOT_TOKEN.')
    return new Response(JSON.stringify({ error: 'Bot no configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  let update: TelegramUpdate
  try {
    update = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  const chatId = update.message?.chat.id
  const text = update.message?.text
  if (!chatId || !text) {
    // Telegram manda otros tipos de updates (ediciones, stickers, etc.)
    // que no nos interesan — respondemos 200 igual para que Telegram no
    // reintente.
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  const parsed = parseTelegramMessage(text)
  const reply = async (msg: string) => sendTelegramMessage(botToken, chatId, msg)

  if (parsed.kind === 'command') {
    if (parsed.command === 'ayuda' || parsed.command === 'start') {
      await reply(buildHelpReply())
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Los comandos de consulta requieren que el chat esté vinculado.
    const { data: link, error: findError } = await supabaseAdmin
      .from('telegram_links')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (findError || !link) {
      await reply(buildNotLinkedReply())
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    try {
      if (parsed.command === 'saldo') {
        const summary = await fetchFinancialSummary(supabaseAdmin, link.user_id)
        await reply(buildSaldoReply(summary.totalBalance, summary.walletCount))
      } else if (parsed.command === 'gastado') {
        const summary = await fetchFinancialSummary(supabaseAdmin, link.user_id)
        await reply(buildGastadoReply(summary.monthlyExpense, summary.monthlyIncome))
      } else if (parsed.command === 'safetospend') {
        const [summary, data] = await Promise.all([
          fetchFinancialSummary(supabaseAdmin, link.user_id),
          fetchSafeToSpendData(supabaseAdmin, link.user_id),
        ])
        const result = computeSafeToSpend({
          totalBalance: summary.totalBalance,
          ...data,
          monthlyIncome: summary.monthlyIncome,
          daysRemaining: getDaysRemainingInMonth(new Date()),
        })
        await reply(buildSafeToSpendReply(result, summary.totalBalance))
      } else if (parsed.command === 'score') {
        const data = await fetchAdviceData(supabaseAdmin, link.user_id)
        await reply(buildScoreReply(data.healthScore, data.noData))
      } else if (parsed.command === 'consejos') {
        const data = await fetchAdviceData(supabaseAdmin, link.user_id)
        const messages = generateAdviceMessages({
          healthScore: data.healthScore,
          safeToSpendToday: data.safeToSpendToday,
          hasSubscriptionPriceIncrease: data.hasSubscriptionPriceIncrease,
          exceededBudgetCategoryNames: data.exceededBudgetCategoryNames,
          hasHighInterestDebt: data.hasHighInterestDebt,
          largeInstallmentDescription: data.largeInstallmentDescription,
          brokenStreakDays: data.brokenStreakDays,
          stalledGoalNames: data.stalledGoalNames,
          hasNoCategories: data.hasNoCategories,
          hasExpensesButNoIncome: data.hasExpensesButNoIncome,
          householdUnsettledDays: data.householdUnsettledDays,
        })
        await reply(buildConsejosReply(messages, data.noData))
      } else if (parsed.command === 'deudas') {
        const { data, error } = await supabaseAdmin
          .from('debts')
          .select('description, counterparty_name, debt_type, total_amount, remaining_amount, currency')
          .eq('user_id', link.user_id)
          .order('created_at', { ascending: false })
        if (error) throw error
        await reply(
          buildDebtsReply(
            (data ?? []).map((d) => ({
              description: d.description,
              counterpartyName: d.counterparty_name,
              debtType: d.debt_type,
              totalAmount: Number(d.total_amount),
              remainingAmount: Number(d.remaining_amount),
              currency: d.currency,
            }))
          )
        )
      } else if (parsed.command === 'cuotas') {
        const [purchases, payments] = await Promise.all([
          supabaseAdmin
            .from('installment_purchases')
            .select('id, description, total_amount, installments_count')
            .eq('user_id', link.user_id)
            .order('created_at', { ascending: false }),
          supabaseAdmin.from('installment_payments').select('installment_purchase_id').eq('user_id', link.user_id),
        ])
        if (purchases.error || payments.error) throw purchases.error || payments.error
        const paidCountByPurchase = new Map<string, number>()
        for (const p of payments.data ?? []) {
          paidCountByPurchase.set(p.installment_purchase_id, (paidCountByPurchase.get(p.installment_purchase_id) ?? 0) + 1)
        }
        await reply(
          buildCuotasReply(
            (purchases.data ?? []).map((p) => ({
              description: p.description,
              totalAmount: Number(p.total_amount),
              installmentsCount: p.installments_count,
              paidCount: paidCountByPurchase.get(p.id) ?? 0,
              monthlyAmount: p.installments_count > 0 ? Number(p.total_amount) / p.installments_count : 0,
            }))
          )
        )
      } else if (parsed.command === 'metas') {
        const { data, error } = await supabaseAdmin
          .from('savings_goals')
          .select('name, target_amount, current_amount, monthly_contribution')
          .eq('user_id', link.user_id)
          .order('created_at', { ascending: false })
        if (error) throw error
        await reply(
          buildMetasReply(
            (data ?? []).map((g) => ({
              name: g.name,
              targetAmount: Number(g.target_amount),
              currentAmount: Number(g.current_amount),
              monthlyContribution: Number(g.monthly_contribution),
            }))
          )
        )
      } else if (parsed.command === 'fijos') {
        const { data, error } = await supabaseAdmin
          .from('recurring_expenses')
          .select('title, amount, currency, expense_kind, billing_frequency, billing_day')
          .eq('user_id', link.user_id)
          .eq('is_active', true)
          .order('billing_day', { ascending: true })
        if (error) throw error
        await reply(
          buildFijosReply(
            (data ?? []).map((r) => ({
              title: r.title,
              amount: Number(r.amount),
              currency: r.currency,
              expenseKind: r.expense_kind,
              billingFrequency: r.billing_frequency,
              billingDay: r.billing_day,
            }))
          )
        )
      } else if (parsed.command === 'hogar') {
        const household = await fetchHouseholdData(supabaseAdmin, link.user_id)
        await reply(buildHogarReply(household.balance, household.unsettledDays))
      } else if (parsed.command === 'billeteras') {
        const balances = await fetchWalletBalances(supabaseAdmin, link.user_id)
        await reply(buildBilleterasReply(balances))
      } else if (parsed.command === 'vencimientos') {
        const dueItems = await fetchUpcomingDueItems(supabaseAdmin, link.user_id)
        await reply(buildVencimientosReply(dueItems))
      }
    } catch (err) {
      console.error('Error consultando datos para el bot:', err)
      await reply('Hubo un error consultando tus datos. Probá de nuevo en un rato.')
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (parsed.kind === 'link_code') {
    const { data: linkRow, error: linkError } = await supabaseAdmin
      .from('telegram_links')
      .select('id, user_id, linked_at')
      .eq('linking_code', parsed.code)
      .maybeSingle()

    if (linkError || !linkRow) {
      await reply(buildLinkInvalidReply())
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { error: updateError } = await supabaseAdmin
      .from('telegram_links')
      .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString() })
      .eq('id', linkRow.id)

    if (updateError) {
      console.error('Error vinculando chat_id:', updateError)
      await reply(buildLinkErrorReply())
    } else {
      await reply(buildLinkSuccessReply())
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (parsed.kind === 'unknown_command') {
    await reply(buildUnknownCommandReply(parsed.command))
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (parsed.kind === 'unrecognized') {
    await reply(buildUnrecognizedReply())
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Deudas, cuotas, fijos, metas, hogar, billeteras, vencimientos y
  // pagos (deuda/servicio) requieren que el chat esté vinculado —
  // buscamos a qué usuario corresponde este chat_id.
  const { data: link, error: findError } = await supabaseAdmin
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (findError || !link) {
    await reply(buildNotLinkedReply())
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  try {
    if (parsed.kind === 'expense') {
      // Billetera: la pista que dejó el parser ("en Mercado Pago") se
      // matchea contra las billeteras reales del usuario; si no hay match
      // (o no es una billetera), la transacción queda sin wallet_id.
      let walletId: string | null = null
      let walletName: string | null = null
      if (parsed.wallet) {
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from('wallets')
          .select('id, name')
          .eq('user_id', link.user_id)
          .ilike('name', `%${parsed.wallet.replace(/[%_]/g, '')}%`)
          .maybeSingle()
        if (walletError) throw walletError
        walletId = wallet?.id ?? null
        walletName = wallet?.name ?? null
      }

      // Categoría: el hint "Transporte" (SUBE, transporte, bondi...) se
      // resuelve contra la categoría del usuario que contenga "transporte";
      // si no existe, queda sin categoría.
      let categoryId: string | null = null
      let categoryName: string | null = null
      if (parsed.categoryHint === 'Transporte') {
        const { data: category, error: categoryError } = await supabaseAdmin
          .from('categories')
          .select('id, name')
          .eq('user_id', link.user_id)
          .ilike('name', '%transporte%')
          .maybeSingle()
        if (categoryError) throw categoryError
        categoryId = category?.id ?? null
        categoryName = category?.name ?? null
      }

      const { error: insertError } = await supabaseAdmin.from('transactions').insert([
        {
          user_id: link.user_id,
          type: parsed.type,
          description: parsed.description,
          payment_method: 'Otro (Telegram)',
          is_usd: false,
          amount_usd: null,
          amount_ars: parsed.amount,
          exchange_rate: null,
          category_id: categoryId,
          wallet_id: walletId,
        },
      ])
      if (insertError) throw insertError
      await reply(
        buildExpenseConfirmedReply(
          parsed.amount,
          parsed.description,
          parsed.type,
          walletName,
          categoryName,
          parsed.notes
        )
      )
    } else if (parsed.kind === 'debt') {
      const { error: insertError } = await supabaseAdmin.from('debts').insert([
        {
          user_id: link.user_id,
          description: `Deuda con ${parsed.counterpartyName}`,
          counterparty_name: parsed.counterpartyName,
          debt_type: parsed.debtType,
          currency: 'ARS',
          total_amount: parsed.amount,
          remaining_amount: parsed.amount,
          interest_rate: 0,
          due_date: null,
          notes: parsed.notes,
        },
      ])
      if (insertError) throw insertError
      await reply(buildDebtConfirmedReply(parsed.debtType, parsed.amount, parsed.counterpartyName, parsed.notes))
    } else if (parsed.kind === 'installment') {
      const { error: insertError } = await supabaseAdmin.from('installment_purchases').insert([
        {
          user_id: link.user_id,
          description: parsed.description,
          total_amount: parsed.totalAmount,
          installments_count: parsed.installmentsCount,
          first_installment_date: new Date().toISOString().slice(0, 10),
          category_id: null,
          payment_method: null,
          notes: parsed.notes,
        },
      ])
      if (insertError) throw insertError
      await reply(
        buildInstallmentConfirmedReply(
          parsed.description,
          parsed.totalAmount,
          parsed.installmentsCount,
          parsed.installmentAmount,
          parsed.notes
        )
      )
    } else if (parsed.kind === 'recurring') {
      const { error: insertError } = await supabaseAdmin.from('recurring_expenses').insert([
        {
          user_id: link.user_id,
          title: parsed.description,
          amount: parsed.amount,
          currency: 'ARS',
          billing_day: new Date().getDate(),
          billing_frequency: 'monthly',
          billing_month: null,
          expense_kind: parsed.expenseKind,
          category_id: null,
          payment_method: null,
          wallet_id: null,
          membership_type: null,
          tax_percentage: 0,
          is_active: true,
        },
      ])
      if (insertError) throw insertError
      await reply(buildRecurringConfirmedReply(parsed.description, parsed.amount, parsed.expenseKind))
    } else if (parsed.kind === 'debt_payment') {
      const result = await handleDebtPayment(
        supabaseAdmin,
        link.user_id,
        parsed.amount,
        parsed.personName,
        parsed.paymentType
      )
      await reply(result.reply)
    } else if (parsed.kind === 'recurring_payment') {
      const result = await handleRecurringPayment(supabaseAdmin, link.user_id, parsed.amount, parsed.serviceName)
      await reply(result.reply)
    } else if (parsed.kind === 'installment_payment') {
      const result = await handleInstallmentPayment(
        supabaseAdmin,
        link.user_id,
        parsed.purchaseName,
        parsed.amount,
        parsed.installmentNumber
      )
      await reply(result.reply)
    } else if (parsed.kind === 'savings_goal') {
      const { error: insertError } = await supabaseAdmin.from('savings_goals').insert([
        {
          user_id: link.user_id,
          name: parsed.name,
          target_amount: parsed.targetAmount,
          current_amount: 0,
          monthly_contribution: 0,
          monthly_interest_rate: 0,
          color: null,
        },
      ])
      if (insertError) throw insertError
      await reply(buildSavingsGoalConfirmedReply(parsed.name, parsed.targetAmount))
    }
  } catch (err) {
    console.error('Error insertando desde Telegram:', err)
    await reply(parsed.kind === 'expense' ? buildExpenseErrorReply() : buildSaveErrorReply())
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
