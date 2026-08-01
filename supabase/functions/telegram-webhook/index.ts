// Edge Function: telegram-webhook
//
// Qué hace: recibe los mensajes que le llegan al bot de Telegram
// (webhook configurado con setWebhook, ver README.md). Casos:
//
// 1. Comandos (/saldo, /gastado, /safetospend, /ayuda) — si el chat ya
//    está vinculado, consulta los datos del usuario y responde.
// 2. Código de vinculación de 6 dígitos (con o sin "/start" adelante) —
//    busca ese código en telegram_links y completa el telegram_chat_id.
// 3. Cualquier otro mensaje con un monto reconocible (ej. "Gasto 4500
//    café") — si el chat_id ya está vinculado, inserta una transacción
//    de gasto para ese usuario.
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
  buildExpenseConfirmedReply,
  buildExpenseErrorReply,
  buildGastadoReply,
  buildHelpReply,
  buildLinkErrorReply,
  buildLinkInvalidReply,
  buildLinkSuccessReply,
  buildNotLinkedReply,
  buildSafeToSpendReply,
  buildSaldoReply,
  buildUnknownCommandReply,
  buildUnrecognizedReply,
  computeSafeToSpend,
  getDaysRemainingInMonth,
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

  for (const t of transactions) {
    const amount = Number(t.amount_ars) || 0
    if (t.type === 'income') {
      totalIncome += amount
      if (t.created_at && new Date(t.created_at).getTime() >= monthStart) monthlyIncome += amount
    } else {
      totalExpense += amount
      if (t.created_at && new Date(t.created_at).getTime() >= monthStart) monthlyExpense += amount
    }
  }

  return {
    totalBalance: initial + totalIncome - totalExpense,
    monthlyExpense,
    monthlyIncome,
    walletCount: walletsResult.data?.length ?? 0,
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

  // parsed.kind === 'expense' — buscamos a qué usuario corresponde este chat_id.
  const { data: link, error: findError } = await supabaseAdmin
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (findError || !link) {
    await reply(buildNotLinkedReply())
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  const { error: insertError } = await supabaseAdmin.from('transactions').insert([
    {
      user_id: link.user_id,
      type: 'expense',
      description: parsed.description,
      payment_method: 'Otro (Telegram)',
      is_usd: false,
      amount_usd: null,
      amount_ars: parsed.amount,
      exchange_rate: null,
      category_id: null,
    },
  ])

  if (insertError) {
    console.error('Error insertando transacción desde Telegram:', insertError)
    await reply(buildExpenseErrorReply())
  } else {
    await reply(buildExpenseConfirmedReply(parsed.amount, parsed.description))
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
