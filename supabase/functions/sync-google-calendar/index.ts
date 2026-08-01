// Edge Function: sync-google-calendar
//
// La invoca el usuario logueado (botón "Sincronizar ahora" en la app, o
// automáticamente al conectar). A diferencia de send-renewal-reminders
// y telegram-webhook (que corren por cron/webhook sin un usuario
// logueado), esta función SÍ requiere JWT válido de Supabase — la
// llama supabase.functions.invoke() desde el frontend, que ya manda el
// token de la sesión activa.
//
// Qué hace:
// 1. Identifica al usuario a partir del JWT.
// 2. Busca su refresh_token de Google guardado en google_calendar_tokens.
// 3. Pide un access_token nuevo a Google con ese refresh_token.
// 4. Trae sus suscripciones y servicios/alquiler activos, compras en
//    cuotas con sus pagos, y deudas a pagar.
// 5. Para cada uno, crea o actualiza un evento en Google Calendar
//    (busca en google_calendar_events si ya existe un evento mapeado).
//    Si la entidad ya no genera evento (cuota pagada, deuda saldada,
//    recurrente desactivado), borra el evento de Google asociado.
//
// Variables de entorno necesarias (ver README.md):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — las mismas credenciales
//   OAuth que configuraste en Supabase Authentication > Providers >
//   Google, pero acá hacen falta COMO SECRETS DE ESTA FUNCIÓN también,
//   porque Supabase Auth no expone sus propios secrets a las Edge
//   Functions.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildCalendarEvent,
  buildDebtCalendarEvent,
  buildInstallmentCalendarEvent,
  type DebtForCalendar,
  type GoogleCalendarEventPayload,
  type InstallmentPurchaseForCalendar,
  type RecurringExpenseForCalendar,
} from './calendar-event.ts'

async function refreshGoogleAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`No se pudo refrescar el token de Google: ${response.status} ${text}`)
  }

  const data = await response.json()
  return data.access_token
}

async function upsertCalendarEvent(
  accessToken: string,
  calendarId: string,
  existingEventId: string | null,
  payload: GoogleCalendarEventPayload
): Promise<string> {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  const url = existingEventId ? `${base}/${existingEventId}` : base
  const method = existingEventId ? 'PATCH' : 'POST'

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Error de la API de Google Calendar (${response.status}): ${text}`)
  }

  const data = await response.json()
  return data.id
}

async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok && response.status !== 404) {
    const text = await response.text()
    throw new Error(`Error de la API de Google Calendar al borrar evento (${response.status}): ${text}`)
  }
}

Deno.serve(async (req: Request) => {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'Faltan configurar GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Cliente "como el usuario" (usa el JWT de la request) para saber
  // quién está llamando — verify_jwt está en true para esta función
  // (a diferencia de las otras dos), así que Supabase ya validó que el
  // JWT es legítimo antes de que este código corra.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await supabaseAsUser.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // A partir de acá usamos la service role key para leer/escribir sin
  // depender de las políticas RLS (ya sabemos quién es el usuario, y
  // solo tocamos sus propias filas filtrando por user.id a mano).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('refresh_token, calendar_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return new Response(JSON.stringify({ error: 'Google Calendar no está conectado.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let accessToken: string
  try {
    accessToken = await refreshGoogleAccessToken(tokenRow.refresh_token, clientId, clientSecret)
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: 'No se pudo renovar el acceso a Google. Reconectá Google Calendar.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [recurringResult, installmentsResult, installmentPaymentsResult, debtsResult] = await Promise.all([
    supabaseAdmin
      .from('recurring_expenses')
      .select('id, title, amount, currency, billing_day, billing_frequency, billing_month, expense_kind')
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabaseAdmin
      .from('installment_purchases')
      .select('id, description, total_amount, installments_count, first_installment_date')
      .eq('user_id', user.id),
    supabaseAdmin
      .from('installment_payments')
      .select('installment_purchase_id, installment_number')
      .eq('user_id', user.id),
    supabaseAdmin
      .from('debts')
      .select('id, description, remaining_amount, currency, due_date, debt_type')
      .eq('user_id', user.id),
  ])

  for (const result of [recurringResult, installmentsResult, installmentPaymentsResult, debtsResult]) {
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const { data: existingMappings } = await supabaseAdmin
    .from('google_calendar_events')
    .select('source_table, source_id, google_event_id')
    .eq('user_id', user.id)

  const mappingKey = (sourceTable: string, sourceId: string) => `${sourceTable}:${sourceId}`
  const mappingBySource = new Map((existingMappings ?? []).map((m) => [mappingKey(m.source_table, m.source_id), m.google_event_id]))

  const paidByPurchase = new Map<string, number[]>()
  for (const payment of installmentPaymentsResult.data ?? []) {
    const paid = paidByPurchase.get(payment.installment_purchase_id) ?? []
    paid.push(payment.installment_number)
    paidByPurchase.set(payment.installment_purchase_id, paid)
  }

  type SourceEntry = {
    table: 'recurring_expenses' | 'installment_purchases' | 'debts'
    id: string
    label: string
    payload: GoogleCalendarEventPayload | null
  }

  const entries: SourceEntry[] = []
  for (const item of (recurringResult.data ?? []) as RecurringExpenseForCalendar[]) {
    entries.push({ table: 'recurring_expenses', id: item.id, label: item.title, payload: buildCalendarEvent(item) })
  }
  for (const item of (installmentsResult.data ?? []) as InstallmentPurchaseForCalendar[]) {
    entries.push({
      table: 'installment_purchases',
      id: item.id,
      label: item.description,
      payload: buildInstallmentCalendarEvent(item, paidByPurchase.get(item.id) ?? []),
    })
  }
  for (const item of (debtsResult.data ?? []) as DebtForCalendar[]) {
    entries.push({ table: 'debts', id: item.id, label: item.description, payload: buildDebtCalendarEvent(item) })
  }

  let synced = 0
  const errors: string[] = []

  for (const entry of entries) {
    try {
      const key = mappingKey(entry.table, entry.id)
      const existingEventId = mappingBySource.get(key) ?? null

      if (entry.payload === null) {
        if (existingEventId) {
          await deleteCalendarEvent(accessToken, tokenRow.calendar_id, existingEventId)
          await supabaseAdmin
            .from('google_calendar_events')
            .delete()
            .eq('source_table', entry.table)
            .eq('source_id', entry.id)
        }
        continue
      }

      const googleEventId = await upsertCalendarEvent(accessToken, tokenRow.calendar_id, existingEventId, entry.payload)

      await supabaseAdmin.from('google_calendar_events').upsert(
        {
          user_id: user.id,
          source_table: entry.table,
          source_id: entry.id,
          google_event_id: googleEventId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_table,source_id' }
      )
      synced++
    } catch (err) {
      console.error(`Error sincronizando "${entry.label}":`, err)
      errors.push(entry.label)
    }
  }

  return new Response(JSON.stringify({ synced, total: entries.length, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
