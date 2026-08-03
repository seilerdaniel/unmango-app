// Lógica pura de la Edge Function mercadopago-checkout, sin Deno ni
// Mercado Pago, para poder testearla con Vitest igual que el resto del
// proyecto (mismo patrón que reply-builder.ts del telegram-webhook).
//
// index.ts (la Edge Function en sí) importa esto y solo agrega la parte
// de red/entorno: leer MERCADOPAGO_ACCESS_TOKEN, identificar al usuario
// por JWT, hacer el POST a la API de Mercado Pago y devolver init_point.

export const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com'

export type CheckoutPlan = 'pro' | 'hogar'

/**
 * Precios de los planes en PESOS ARGENTINOS (equivalentes a los US$ que
 * se muestran en la UI: PRO ~US$9.99, HOGAR ~US$29.99). Son el valor por
 * defecto; el deploy puede sobreescribirlos con las env vars
 * MERCADOPAGO_PRO_PRICE_ARS / MERCADOPAGO_HOGAR_PRICE_ARS sin cambiar
 * código.
 */
export const PLAN_DEFAULT_PRICES_ARS: Record<CheckoutPlan, number> = {
  pro: 12000,
  hogar: 35000,
}

export function isSupportedPlan(plan: string | undefined | null): plan is CheckoutPlan {
  return plan === 'pro' || plan === 'hogar'
}

/** Precio ARS del plan, usando el override si es un número válido. */
export function getPlanPrice(
  plan: CheckoutPlan,
  overrides: Partial<Record<CheckoutPlan, number>> = {}
): number {
  const overridden = overrides[plan]
  if (overridden !== undefined && Number.isFinite(overridden) && overridden > 0) {
    return overridden
  }
  return PLAN_DEFAULT_PRICES_ARS[plan]
}

/**
 * external_reference que viaja en el preapproval de Mercado Pago y que el
 * webhook después parsea para saber a qué usuario y plan activar:
 * "unmango_<userId>_<plan>".
 */
export function buildExternalReference(userId: string, plan: CheckoutPlan): string {
  return `unmango_${userId}_${plan}`
}

export function parseExternalReference(
  ref: string | null | undefined
): { userId: string; plan: CheckoutPlan } | null {
  if (!ref) return null
  const match = ref.match(/^unmango_([^_]+)_(pro|hogar)$/)
  if (!match) return null
  return { userId: match[1], plan: match[2] as CheckoutPlan }
}

export interface PreapprovalPayload {
  reason: string
  external_reference: string
  auto_recurring: {
    frequency: number
    frequency_type: 'months'
    transaction_amount: number
    currency_id: 'ARS'
  }
  payer_email: string
  back_url: string
  notification_url: string
  metadata: { userId: string; plan: CheckoutPlan }
}

/**
 * Arma el body del POST /preapproval de Mercado Pago (suscripción
 * recurrente mensual en ARS). back_url vuelve a la app tras pagar o
 * cancelar; notification_url es el webhook de esta app.
 */
export function buildPreapprovalPayload(input: {
  userId: string
  plan: CheckoutPlan
  priceArs: number
  payerEmail: string
  appUrl: string
  webhookUrl: string
}): PreapprovalPayload {
  return {
    reason: `UnMango ${input.plan.toUpperCase()}`,
    external_reference: buildExternalReference(input.userId, input.plan),
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: input.priceArs,
      currency_id: 'ARS',
    },
    payer_email: input.payerEmail,
    back_url: `${input.appUrl}?payment=success&plan=${input.plan}`,
    notification_url: input.webhookUrl,
    metadata: { userId: input.userId, plan: input.plan },
  }
}
