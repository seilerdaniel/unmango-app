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
// 4. Trae sus suscripciones y servicios/alquiler activos.
// 5. Para cada uno, crea o actualiza un evento en Google Calendar
//    (busca en google_calendar_events si ya existe un evento mapeado).
//
// Variables de entorno necesarias (ver README.md):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — las mismas credenciales
//   OAuth que configuraste en Supabase Authentication > Providers >
//   Google, pero acá hacen falta COMO SECRETS DE ESTA FUNCIÓN también,
//   porque Supabase Auth no expone sus propios secrets a las Edge
//   Functions.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildCalendarEvent, type RecurringExpenseForCalendar } from './calendar-event.ts'

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
  payload: ReturnType<typeof buildCalendarEvent>
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

  const { data: recurringItems, error: recurringError } = await supabaseAdmin
    .from('recurring_expenses')
    .select('id, title, amount, currency, billing_day, billing_frequency, billing_month, expense_kind')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (recurringError) {
    return new Response(JSON.stringify({ error: recurringError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: existingMappings } = await supabaseAdmin
    .from('google_calendar_events')
    .select('source_id, google_event_id')
    .eq('user_id', user.id)
    .eq('source_table', 'recurring_expenses')

  const mappingBySourceId = new Map((existingMappings ?? []).map((m) => [m.source_id, m.google_event_id]))

  let synced = 0
  const errors: string[] = []

  for (const item of (recurringItems ?? []) as RecurringExpenseForCalendar[]) {
    try {
      const payload = buildCalendarEvent(item)
      const existingEventId = mappingBySourceId.get(item.id) ?? null
      const googleEventId = await upsertCalendarEvent(accessToken, tokenRow.calendar_id, existingEventId, payload)

      await supabaseAdmin.from('google_calendar_events').upsert(
        {
          user_id: user.id,
          source_table: 'recurring_expenses',
          source_id: item.id,
          google_event_id: googleEventId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_table,source_id' }
      )
      synced++
    } catch (err) {
      console.error(`Error sincronizando "${item.title}":`, err)
      errors.push(item.title)
    }
  }

  return new Response(JSON.stringify({ synced, total: (recurringItems ?? []).length, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
