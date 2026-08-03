// Lógica pura de la Edge Function stripe-checkout, sin Deno ni Stripe,
// para poder testearla con Vitest igual que el resto del proyecto (mismo
// patrón que mercadopago-checkout/core.ts).
//
// index.ts (la Edge Function en sí) importa esto y solo agrega la parte
// de red/entorno: leer STRIPE_SECRET_KEY, identificar al usuario por JWT,
// crear el Price (si no hay STRIPE_PRICE_* configurado) y la Checkout
// Session de Stripe, y devolver { url }.
//
// Nota de duplicación: isSupportedPlan es el mismo de
// mercadopago-checkout/core.ts, pero cada Edge Function se despliega con
// su propio directorio — no puede importar de otra carpeta.

export const STRIPE_API_BASE = 'https://api.stripe.com'

export type CheckoutPlan = 'pro' | 'hogar'

/**
 * Precios en DÓLARES (centavos de USD) de los planes mensuales:
 * PRO = US$9.99 (999 centavos), HOGAR = US$29.99 (2.999 centavos).
 * Es la tarifa fija que se cobra en Stripe (currency usd).
 */
export const PLAN_PRICES_USD_CENTS: Record<CheckoutPlan, number> = {
  pro: 999,
  hogar: 2999,
}

export function isSupportedPlan(plan: string | undefined | null): plan is CheckoutPlan {
  return plan === 'pro' || plan === 'hogar'
}

/** Precio en centavos de USD del plan. */
export function getPlanPriceCents(plan: CheckoutPlan): number {
  return PLAN_PRICES_USD_CENTS[plan]
}

/** Params de `stripe.prices.create` para el plan (suscripción mensual). */
export function buildPriceCreateParams(plan: CheckoutPlan): {
  currency: 'usd'
  unit_amount: number
  recurring: { interval: 'month' }
  product_data: { name: string }
  metadata: { plan: CheckoutPlan }
} {
  return {
    currency: 'usd',
    unit_amount: getPlanPriceCents(plan),
    recurring: { interval: 'month' },
    product_data: { name: `UnMango ${plan.toUpperCase()}` },
    metadata: { plan },
  }
}

/**
 * Params de `stripe.checkout.sessions.create` con mode 'subscription'.
 * `client_reference_id` y `metadata` llevan el userId/plan; además se
 * copian en `subscription_data.metadata` para que la Subscription (y por
 * lo tanto los eventos de webhook invoice.payment_succeeded y
 * customer.subscription.*) traigan siempre el plan y el userId, sin tener
 * que consultar la sesión original.
 */
export function buildCheckoutSessionParams(input: {
  plan: CheckoutPlan
  priceId: string
  userId: string
  customerEmail: string
  appUrl: string
}): {
  mode: 'subscription'
  customer_email: string
  client_reference_id: string
  metadata: { plan: CheckoutPlan; userId: string }
  subscription_data: { metadata: { plan: CheckoutPlan; userId: string } }
  line_items: Array<{ price: string; quantity: 1 }>
  success_url: string
  cancel_url: string
} {
  return {
    mode: 'subscription',
    customer_email: input.customerEmail,
    client_reference_id: input.userId,
    metadata: { plan: input.plan, userId: input.userId },
    subscription_data: { metadata: { plan: input.plan, userId: input.userId } },
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${input.appUrl}?payment=success&plan=${input.plan}`,
    cancel_url: `${input.appUrl}?payment=canceled&plan=${input.plan}`,
  }
}
