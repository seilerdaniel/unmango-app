// Edge Function: send-renewal-reminders
//
// Qué hace: busca las suscripciones activas (recurring_expenses) de
// TODOS los usuarios cuyo próximo vencimiento cae dentro de
// REMINDER_DAYS_BEFORE días, agrupa por usuario, y le manda un email a
// cada uno con Resend (https://resend.com).
//
// Por qué existe como Edge Function y no como código del frontend: esto
// tiene que correr una vez por día para TODOS los usuarios, sin que
// nadie tenga la app abierta — el frontend no puede hacer eso. Se
// invoca via cron (ver supabase/reminders_cron.sql), no desde la app.
//
// Variables de entorno que necesita (setear con `supabase secrets set`,
// ver README.md en esta misma carpeta para el paso a paso completo):
//   RESEND_API_KEY   — tu API key de Resend
//   REMINDER_FROM_EMAIL — remitente verificado en Resend (opcional,
//                          por defecto usa la dirección de pruebas de Resend)
//   CRON_SECRET      — secreto compartido para que solo el cron (o vos)
//                       puedan invocar esta función, no cualquiera en
//                       internet
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase
// automáticamente en toda Edge Function — no hace falta configurarlos.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildReminderEmailHtml,
  groupByUser,
  selectDueForReminder,
  type RecurringExpenseForReminder,
} from './date-utils.ts'

// Con cuántos días de anticipación se manda el aviso. Si lo cambiás acá,
// no hace falta tocar nada más (el cron solo dispara la función una vez
// por día; el filtro de "cuánto falta" vive todo acá adentro).
const REMINDER_DAYS_BEFORE = 3

const DEFAULT_FROM = 'UnMango <onboarding@resend.dev>'

Deno.serve(async (req: Request) => {
  // Protección básica: solo procesa la request si trae el secreto
  // correcto. Evita que cualquiera en internet dispare envíos de email
  // masivos golpeando esta URL.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret) {
    const providedSecret = req.headers.get('x-cron-secret')
    if (providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('REMINDER_FROM_EMAIL') || DEFAULT_FROM

  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'Falta configurar el secret RESEND_API_KEY.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Cliente con la service role key: bypassa RLS a propósito, porque
  // esta función necesita mirar las suscripciones de TODOS los usuarios,
  // no de uno solo (no hay una sesión de usuario acá, es un proceso de
  // servidor corriendo por cron).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: recurring, error } = await supabaseAdmin
    .from('recurring_expenses')
    .select('id, user_id, title, amount, currency, billing_day')
    .eq('is_active', true)

  if (error) {
    console.error('Error consultando recurring_expenses:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const dueItems = selectDueForReminder(
    (recurring ?? []) as RecurringExpenseForReminder[],
    REMINDER_DAYS_BEFORE
  )
  const byUser = groupByUser(dueItems)

  const results: { userId: string; email?: string; status: number | string }[] = []

  for (const [userId, items] of byUser) {
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !userData?.user?.email) {
      results.push({ userId, status: 'sin email / usuario no encontrado' })
      continue
    }

    const email = userData.user.email

    try {
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject:
            items.length === 1
              ? `Tu suscripción a ${items[0].title} vence pronto`
              : `Tenés ${items.length} suscripciones que vencen pronto`,
          html: buildReminderEmailHtml(items),
        }),
      })

      results.push({ userId, email, status: resendResponse.status })

      if (!resendResponse.ok) {
        console.error(`Resend devolvió ${resendResponse.status} para ${email}`)
      }
    } catch (sendError) {
      console.error(`Error enviando email a ${email}:`, sendError)
      results.push({ userId, email, status: 'error de red al enviar' })
    }
  }

  return new Response(
    JSON.stringify({
      checked: recurring?.length ?? 0,
      dueToday: dueItems.length,
      usersNotified: results.length,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
