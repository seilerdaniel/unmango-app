// Edge Function: stripe-webhook
//
// Recibe los webhooks de Stripe (checkout.session.completed,
// invoice.payment_succeeded, customer.subscription.updated y
// customer.subscription.deleted). Según el evento activa, renueva o cancela
// la fila en la tabla `subscriptions` del usuario (plan 'pro' | 'hogar').
//
// La invoca Stripe (no trae JWT de Supabase) → verify_jwt = false
// (config.toml). La seguridad la da la firma: verificamos el header
// `Stripe-Signature` (HMAC-SHA256 del body con STRIPE_WEBHOOK_SECRET) antes
// de procesar nada; un webhook sin firma válida recibe 400.
//
// Respondemos HTTP 200 de inmediato (Stripe espera un ack rápido y reintenta
// si no respondemos OK) y el procesamiento sigue en background dentro del
// mismo runtime. El upsert es idempotente (onConflict: 'user_id').
//
// Variables de entorno necesarias (ver README.md):
//   STRIPE_WEBHOOK_SECRET — secreto del endpoint (whsec_...) que se ve en
//     Stripe Dashboard → Developers → Webhooks al crear el endpoint.
//   STRIPE_SECRET_KEY — clave de la cuenta (para consultar la Subscription
//     por id en invoice.payment_succeeded si el payload no trae metadata).
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase (el webhook
// escribe con la service role, no confía en el payload entrante).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  STRIPE_API_BASE,
  processStripeEvent,
  type StripeEvent,
  type WebhookDeps,
  verifyStripeSignature,
} from './core.ts'

Deno.serve(async (req: Request) => {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    // Sin secret configurado no podemos validar la firma → no procesamos.
    return new Response('ok', { status: 200 })
  }

  const rawBody = await req.text()
  const verified = await verifyStripeSignature({
    rawBody,
    sigHeader: req.headers.get('Stripe-Signature'),
    webhookSecret,
  })
  if (!verified.ok) {
    console.error('stripe-webhook: firma inválida —', verified.reason)
    return new Response(`invalid signature: ${verified.reason}`, { status: 400 })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return new Response('invalid JSON', { status: 400 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')

  const deps: WebhookDeps = {
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
    fetchSubscription: async (subscriptionId) => {
      const response = await fetch(`${STRIPE_API_BASE}/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${secretKey ?? ''}` },
      })
      if (!response.ok) {
        throw new Error(`Stripe respondió ${response.status} para la suscripción ${subscriptionId}`)
      }
      return response.json()
    },
  }

  // Ack inmediato: Stripe espera un 200 rápido. El procesamiento (upsert /
  // fetch de la suscripción) termina en background; los errores se loguean
  // y el upsert es idempotente, así que un reintento de Stripe no duplica.
  void processStripeEvent(event, deps)
    .then((result) => console.log('stripe-webhook:', JSON.stringify(result)))
    .catch((err) => console.error('stripe-webhook error:', err))

  return new Response('ok', { status: 200 })
})
