// Edge Function: mercadopago-checkout
//
// Genera el link de checkout recurrente (Preapproval) de Mercado Pago en
// Pesos Argentinos para los planes PRO / HOGAR. La invoca el usuario
// logueado desde PricingModal (`supabase.functions.invoke`), así que trae
// un JWT de Supabase → verify_jwt = true (config.toml).
//
// Qué hace:
// 1. Identifica al usuario a partir del JWT (y valida que el `userId` del
//    body, si viene, coincida — no confiamos en el body).
// 2. Valida el plan ('pro' | 'hogar') y calcula el precio ARS (env vars
//    MERCADOPAGO_PRO_PRICE_ARS / MERCADOPAGO_HOGAR_PRICE_ARS, o default).
// 3. Crea un Preapproval en Mercado Pago (POST /preapproval) con la
//    external_reference "unmango_<userId>_<plan>" y el webhook de
//    notificaciones (notification_url → mercadopago-webhook).
// 4. Devuelve { init_point } para redirigir al checkout seguro.
//
// Variables de entorno necesarias (ver README.md):
//   MERCADOPAGO_ACCESS_TOKEN — token de la aplicación de Mercado Pago.
// Opcionales:
//   MERCADOPAGO_PRO_PRICE_ARS / MERCADOPAGO_HOGAR_PRICE_ARS — precio ARS.
//   APP_URL — origen de la app para back_url (default https://unmango.app).
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  buildPreapprovalPayload,
  getPlanPrice,
  isSupportedPlan,
  MERCADOPAGO_API_BASE,
} from './core.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if (!accessToken) {
    return json({ error: 'Faltan configurar MERCADOPAGO_ACCESS_TOKEN.' }, 500)
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

  const priceArs = getPlanPrice(plan, {
    pro: Number(Deno.env.get('MERCADOPAGO_PRO_PRICE_ARS') ?? NaN),
    hogar: Number(Deno.env.get('MERCADOPAGO_HOGAR_PRICE_ARS') ?? NaN),
  })

  const appUrl = Deno.env.get('APP_URL') ?? 'https://unmango.app'
  const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`

  const payload = buildPreapprovalPayload({
    userId: user.id,
    plan,
    priceArs,
    payerEmail: user.email ?? '',
    appUrl,
    webhookUrl,
  })

  let response: Response
  try {
    response = await fetch(`${MERCADOPAGO_API_BASE}/preapproval`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('Error de red con Mercado Pago:', err)
    return json({ error: 'No se pudo contactar a Mercado Pago. Probá de nuevo en un rato.' }, 502)
  }

  const data = (await response.json().catch(() => ({}))) as {
    id?: string
    init_point?: string
    error?: string
  }

  if (!response.ok) {
    console.error('Mercado Pago rechazó el preapproval:', response.status, JSON.stringify(data))
    return json({ error: 'Mercado Pago rechazó la solicitud. Revisá las credenciales.' }, 502)
  }

  const initPoint = data.init_point ?? null
  if (!initPoint) {
    return json({ error: 'Mercado Pago no devolvió init_point.' }, 502)
  }

  return json({ init_point: initPoint, preapproval_id: data.id ?? null })
})
