// Edge Function: stripe-checkout
//
// Crea una Checkout Session de Stripe en modo 'subscription' (USD) para los
// planes PRO / HOGAR. La invoca el usuario logueado desde PricingModal
// (supabase.functions.invoke), así que trae un JWT de Supabase →
// verify_jwt = true (config.toml).
//
// Qué hace:
// 1. Identifica al usuario a partir del JWT (y valida que el `userId` del
//    body, si viene, coincida — no confiamos en el body).
// 2. Valida el plan ('pro' | 'hogar'). El Price de Stripe se resuelve así:
//    si existe STRIPE_PRICE_PRO_ID / STRIPE_PRICE_HOGAR_ID se usa ese Price
//    (recomendado en producción); si no, se crea uno on-the-fly con el
//    producto "UnMango PRO/HOGAR" a US$9.99 / US$29.99 mensuales.
// 3. Crea la Checkout Session (mode: 'subscription') con client_reference_id
//    y metadata { plan, userId }, copiados también en
//    subscription_data.metadata para que los eventos de webhook
//    (invoice.payment_succeeded, customer.subscription.*) traigan siempre
//    la referencia sin consultar la sesión original.
// 4. Devuelve { url } para redirigir al checkout seguro de Stripe.
//
// Variables de entorno necesarias (ver README.md):
//   STRIPE_SECRET_KEY — clave secreta de la cuenta de Stripe (sk_test_... o
//     sk_live_...). Solo vive del lado del servidor, no se expone al cliente.
// Opcionales:
//   STRIPE_PRICE_PRO_ID / STRIPE_PRICE_HOGAR_ID — Prices ya creados en el
//     dashboard (recomendado en producción para fijar precios).
//   APP_URL — origen de la app para success_url/cancel_url
//     (default https://unmango.app).
//
// SUPABASE_URL y SUPABASE_ANON_KEY los inyecta Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  STRIPE_API_BASE,
  buildCheckoutSessionParams,
  buildPriceCreateParams,
  isSupportedPlan,
} from './core.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Convierte los params de `prices.create` a application/x-www-form-urlencoded. */
function formFromPriceParams(params: ReturnType<typeof buildPriceCreateParams>): URLSearchParams {
  const form = new URLSearchParams()
  form.set('currency', params.currency)
  form.set('unit_amount', String(params.unit_amount))
  form.set('recurring[interval]', params.recurring.interval)
  form.set('product_data[name]', params.product_data.name)
  form.set('metadata[plan]', params.metadata.plan)
  return form
}

/** Convierte los params de `checkout.sessions.create` a form-urlencoded. */
function formFromSessionParams(params: ReturnType<typeof buildCheckoutSessionParams>): URLSearchParams {
  const form = new URLSearchParams()
  form.set('mode', params.mode)
  form.set('customer_email', params.customer_email)
  form.set('client_reference_id', params.client_reference_id)
  form.set('metadata[plan]', params.metadata.plan)
  form.set('metadata[userId]', params.metadata.userId)
  form.set('subscription_data[metadata][plan]', params.subscription_data.metadata.plan)
  form.set('subscription_data[metadata][userId]', params.subscription_data.metadata.userId)
  form.set('line_items[0][price]', params.line_items[0].price)
  form.set('line_items[0][quantity]', String(params.line_items[0].quantity))
  form.set('success_url', params.success_url)
  form.set('cancel_url', params.cancel_url)
  return form
}

Deno.serve(async (req: Request) => {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    return json({ error: 'Faltan configurar STRIPE_SECRET_KEY.' }, 500)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Cliente "como el usuario": usamos el JWT de la request (verify_jwt
  // está en true) para saber quién está llamando, en vez de confiar en
  // el body.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseAsUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userError,
  } = await supabaseAsUser.auth.getUser()
  if (userError || !user) {
    return json({ error: 'No autenticado' }, 401)
  }

  let body: { plan?: string; userId?: string } = {}
  try {
    body = (await req.json()) as { plan?: string; userId?: string }
  } catch {
    // body vacío → plan inválido, cae en el check de abajo
  }

  const plan = body.plan
  if (!isSupportedPlan(plan)) {
    return json({ error: `Plan inválido: ${plan ?? 'faltante'}. Usá 'pro' o 'hogar'.` }, 400)
  }

  if (body.userId && body.userId !== user.id) {
    return json({ error: 'El userId del body no coincide con la sesión.' }, 403)
  }

  // Price: si está configurado el ID por env var lo usamos tal cual; si no,
  // creamos el Price on-the-fly con el mismo producto y precio del core.
  const priceId =
    plan === 'pro'
      ? (Deno.env.get('STRIPE_PRICE_PRO_ID') ?? '')
      : (Deno.env.get('STRIPE_PRICE_HOGAR_ID') ?? '')

  let resolvedPriceId: string
  if (priceId) {
    resolvedPriceId = priceId
  } else {
    let priceResponse: Response
    try {
      priceResponse = await fetch(`${STRIPE_API_BASE}/v1/prices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formFromPriceParams(buildPriceCreateParams(plan)),
      })
    } catch (err) {
      console.error('Error de red creando el Price en Stripe:', err)
      return json({ error: 'No se pudo contactar a Stripe. Probá de nuevo en un rato.' }, 502)
    }

    const priceData = (await priceResponse.json().catch(() => ({}))) as {
      id?: string
      error?: string
    }
    if (!priceResponse.ok || !priceData.id) {
      console.error('Stripe rechazó la creación del Price:', priceResponse.status, JSON.stringify(priceData))
      return json({ error: 'Stripe rechazó la solicitud. Revisá las credenciales.' }, 502)
    }
    resolvedPriceId = priceData.id
  }

  const appUrl = Deno.env.get('APP_URL') ?? 'https://unmango.app'
  const sessionParams = buildCheckoutSessionParams({
    plan,
    priceId: resolvedPriceId,
    userId: user.id,
    customerEmail: user.email ?? '',
    appUrl,
  })

  let sessionResponse: Response
  try {
    sessionResponse = await fetch(`${STRIPE_API_BASE}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formFromSessionParams(sessionParams),
    })
  } catch (err) {
    console.error('Error de red creando la Checkout Session en Stripe:', err)
    return json({ error: 'No se pudo contactar a Stripe. Probá de nuevo en un rato.' }, 502)
  }

  const sessionData = (await sessionResponse.json().catch(() => ({}))) as {
    id?: string
    url?: string
    error?: string
  }

  if (!sessionResponse.ok) {
    console.error('Stripe rechazó la Checkout Session:', sessionResponse.status, JSON.stringify(sessionData))
    return json({ error: 'Stripe rechazó la solicitud. Revisá las credenciales.' }, 502)
  }

  const sessionUrl = sessionData.url ?? null
  if (!sessionUrl) {
    return json({ error: 'Stripe no devolvió una URL de checkout.' }, 502)
  }

  return json({ url: sessionUrl, session_id: sessionData.id ?? null })
})
