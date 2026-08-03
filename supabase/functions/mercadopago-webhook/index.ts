// Edge Function: mercadopago-webhook
//
// Recibe las notificaciones IPN / Notificaciones de Mercado Pago
// (type: payment, authorized_payment, preapproval). Cuando el pago de la
// suscripción está aprobado, activa/renueva la fila en la tabla
// `subscriptions` del usuario (plan 'pro' | 'hogar', status 'active',
// current_period_end = ahora + 30 días).
//
// La invoca Mercado Pago (no trae JWT de Supabase) → verify_jwt = false
// (config.toml). Respondemos HTTP 200 de inmediato (Mercado Pago espera
// un ack rápido y reintenta si no responde OK) y el procesamiento sigue
// en background dentro del mismo runtime.
//
// Variables de entorno necesarias (ver README.md):
//   MERCADOPAGO_ACCESS_TOKEN — token de la aplicación de Mercado Pago
//     (para consultar el recurso por id y ver su status/external_reference).
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase (el
// webhook escribe con la service role, no confía en el payload entrante).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  MERCADOPAGO_API_BASE,
  parseWebhookNotification,
  processMercadoPagoNotification,
  type WebhookDeps,
} from './core.ts'

Deno.serve(async (req: Request) => {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    return new Response('ok', { status: 200 })
  }

  const body = await req.json().catch(() => ({}))
  const urlType = new URL(req.url).searchParams.get('type')
  const notification = parseWebhookNotification(body, urlType)

  if (!notification) {
    // Cuerpo que no es una notificación reconocible: ack y a seguir.
    return new Response('ok', { status: 200 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const deps: WebhookDeps = {
    fetchResource: async (type, resourceId) => {
      const path =
        type === 'preapproval'
          ? `/preapproval/${resourceId}`
          : type === 'authorized_payment'
            ? `/authorized_payments/${resourceId}`
            : `/v1/payments/${resourceId}`

      const response = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        throw new Error(`Mercado Pago respondió ${response.status} para ${type}/${resourceId}`)
      }
      return response.json()
    },
    upsertSubscription: async (input) => {
      return supabaseAdmin.from('subscriptions').upsert(
        {
          user_id: input.userId,
          plan: input.plan,
          status: input.status,
          current_period_end: input.currentPeriodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    },
  }

  // Ack inmediato: Mercado Pago espera un 200 rápido. El procesamiento
  // (fetch del recurso + upsert) termina en background; los errores se
  // loguean y el upsert es idempotente, así que un reintento de MP no
  // duplica nada.
  void processMercadoPagoNotification(notification, deps)
    .then((result) => console.log('mercadopago-webhook:', JSON.stringify(result)))
    .catch((err) => console.error('mercadopago-webhook error:', err))

  return new Response('ok', { status: 200 })
})
