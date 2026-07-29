// Edge Function: telegram-webhook
//
// Qué hace: recibe los mensajes que le llegan al bot de Telegram
// (webhook configurado con setWebhook, ver README.md). Dos casos:
//
// 1. El mensaje es un código de vinculación de 6 dígitos (con o sin
//    "/start" adelante) -> busca ese código en telegram_links y
//    completa el telegram_chat_id, dejando esa cuenta de Telegram
//    vinculada a un usuario de UnMango.
// 2. Cualquier otro mensaje con un monto reconocible (ej. "Gasto 4500
//    café") -> si el chat_id ya está vinculado, inserta una
//    transacción de gasto para ese usuario.
//
// En ambos casos, responde al usuario por Telegram confirmando qué se
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

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
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

  if (parsed.kind === 'link_code') {
    const { data: linkRow, error: linkError } = await supabaseAdmin
      .from('telegram_links')
      .select('id, user_id, linked_at')
      .eq('linking_code', parsed.code)
      .maybeSingle()

    if (linkError || !linkRow) {
      await sendTelegramMessage(botToken, chatId, 'Ese código no es válido. Generá uno nuevo desde la app (Configuración → Vincular Telegram).')
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { error: updateError } = await supabaseAdmin
      .from('telegram_links')
      .update({ telegram_chat_id: chatId, linked_at: new Date().toISOString() })
      .eq('id', linkRow.id)

    if (updateError) {
      console.error('Error vinculando chat_id:', updateError)
      await sendTelegramMessage(botToken, chatId, 'Hubo un error vinculando tu cuenta. Probá de nuevo en un rato.')
    } else {
      await sendTelegramMessage(
        botToken,
        chatId,
        '¡Listo! Tu Telegram ya está vinculado a UnMango. A partir de ahora, mandame mensajes tipo "Gasto 4500 café" y los registro automáticamente.'
      )
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  if (parsed.kind === 'unrecognized') {
    await sendTelegramMessage(
      botToken,
      chatId,
      'No entendí ese mensaje. Mandame algo tipo "Gasto 4500 café", o el código de 6 dígitos que te dio la app si todavía no vinculaste tu cuenta.'
    )
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
  }

  // parsed.kind === 'expense' — buscamos a qué usuario corresponde este chat_id.
  const { data: link, error: findError } = await supabaseAdmin
    .from('telegram_links')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (findError || !link) {
    await sendTelegramMessage(
      botToken,
      chatId,
      'Todavía no vinculaste tu cuenta. Generá un código desde la app (Configuración → Vincular Telegram) y mandámelo acá primero.'
    )
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
    await sendTelegramMessage(botToken, chatId, 'Hubo un error registrando el gasto. Probá de nuevo.')
  } else {
    await sendTelegramMessage(
      botToken,
      chatId,
      `Listo ✅ Registré un gasto de $${parsed.amount.toLocaleString('es-AR')} en "${parsed.description}".`
    )
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
