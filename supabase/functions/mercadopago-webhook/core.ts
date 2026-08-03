// Lógica pura de la Edge Function mercadopago-webhook, sin Deno ni
// Mercado Pago, para poder testearla con Vitest igual que el resto del
// proyecto (mismo patrón que reply-builder.ts / message-parser.ts).
//
// index.ts (la Edge Function en sí) importa esto y solo agrega la parte
// de red/entorno: leer MERCADOPAGO_ACCESS_TOKEN, armar el cliente admin
// de Supabase y mapear el recurso de Mercado Pago.
//
// Nota de duplicación: parseExternalReference es conceptualmente el mismo
// que buildExternalReference/parseExternalReference de
// mercadopago-checkout/core.ts, pero cada Edge Function de Supabase se
// despliega con su propio directorio — no puede importar archivos de otra
// carpeta. Si cambiás el formato, replicá el cambio en ambos lados.

export const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com'

export type CheckoutPlan = 'pro' | 'hogar'

/**
 * Tipos de notificación de Mercado Pago (IPN) que activan/renuevan la
 * suscripción: 'preapproval' (cambio de estado de la suscripción),
 * 'authorized_payment' (cobro de cada cuota) y 'payment' (pago suelto).
 * Otros eventos (test, merchant_order, ...) se ignoran respondiendo 200.
 */
export const HANDLED_WEBHOOK_TYPES = ['payment', 'authorized_payment', 'preapproval']

export interface WebhookNotification {
  type: string
  resourceId: string
}

/**
 * Extrae { type, resourceId } de la notificación IPN de Mercado Pago.
 * type puede venir en el query string (?type=preapproval) o en el body
 * ({ type, data: { id } }); el id del recurso vive en data.id.
 */
export function parseWebhookNotification(
  body: unknown,
  urlType: string | null
): WebhookNotification | null {
  const data = (body ?? {}) as Record<string, unknown>
  const innerData = data.data as Record<string, unknown> | undefined
  const resourceId = innerData?.id ?? data.id
  const type = urlType ?? (typeof data.type === 'string' ? data.type : null)

  if (!type || typeof resourceId !== 'string' || resourceId.length === 0) return null
  return { type, resourceId }
}

export function isHandledWebhookType(type: string): boolean {
  return HANDLED_WEBHOOK_TYPES.includes(type)
}

/**
 * external_reference del recurso de Mercado Pago: "unmango_<userId>_<plan>"
 * (la genera mercadopago-checkout). Duplicado a propósito — ver nota al
 * inicio del archivo.
 */
export function parseExternalReference(
  ref: string | null | undefined
): { userId: string; plan: CheckoutPlan } | null {
  if (!ref) return null
  const match = ref.match(/^unmango_([^_]+)_(pro|hogar)$/)
  if (!match) return null
  return { userId: match[1], plan: match[2] as CheckoutPlan }
}

/**
 * Fin del período actual: un mes después de `from` (current_period_end se
 * guarda como timestamptz ISO UTC). Los cobros mensuales del preapproval
 * renuevan la suscripción evento a evento. Clampa a fin de mes para no
 * desbordar (31 de enero → 28/29 de febrero).
 */
export function computePeriodEndIso(from: Date, months = 1): string {
  const end = new Date(from)
  const dayOfMonth = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(dayOfMonth, lastDay))
  return end.toISOString()
}

/**
 * Un recurso de Mercado Pago "activa" la suscripción cuando su status es
 * autorizado/aprobado:
 * - preapproval: 'authorized' (aprobado y activo).
 * - authorized_payment / payment: 'approved'.
 */
export function shouldActivateForStatus(status: string | null | undefined): boolean {
  return status === 'authorized' || status === 'approved'
}

export interface WebhookDeps {
  /**
   * Trae el recurso de la API de Mercado Pago por tipo e id. Tira si la
   * API no responde (status no OK).
   */
  fetchResource: (
    type: string,
    resourceId: string
  ) => Promise<{ status?: string; external_reference?: string }>
  /** Upsert en la tabla subscriptions del usuario activado. */
  upsertSubscription: (input: {
    userId: string
    plan: CheckoutPlan
    status: 'active'
    currentPeriodEnd: string
  }) => Promise<{ error: unknown }>
}

export interface ProcessResult {
  handled: boolean
  activated: boolean
  reason: string
}

/**
 * Procesa una notificación de Mercado Pago:
 * 1. Descarta eventos que no manejamos.
 * 2. Trae el recurso (preapproval / authorized_payment / payment).
 * 3. Con la external_reference identifica { userId, plan }.
 * 4. Si el status activa, hace upsert en subscriptions con
 *    current_period_end = ahora + 30 días.
 *
 * Idempotente: un mismo recurso reprocesado (Mercado Pago reintenta
 * mientras no respondamos OK) hace el mismo upsert.
 */
export async function processMercadoPagoNotification(
  notification: WebhookNotification,
  deps: WebhookDeps,
  now: Date = new Date()
): Promise<ProcessResult> {
  if (!isHandledWebhookType(notification.type)) {
    return { handled: false, activated: false, reason: `evento no manejado (${notification.type})` }
  }

  let resource: { status?: string; external_reference?: string }
  try {
    resource = await deps.fetchResource(notification.type, notification.resourceId)
  } catch (err) {
    console.error('Error consultando recurso en Mercado Pago:', err)
    return { handled: true, activated: false, reason: 'error consultando el recurso en Mercado Pago' }
  }

  const parsed = parseExternalReference(resource.external_reference)
  if (!parsed) {
    return { handled: true, activated: false, reason: 'el recurso no trae external_reference válida' }
  }

  if (!shouldActivateForStatus(resource.status)) {
    return {
      handled: true,
      activated: false,
      reason: `status "${resource.status ?? 'desconocido'}" no activa la suscripción`,
    }
  }

  const { error } = await deps.upsertSubscription({
    userId: parsed.userId,
    plan: parsed.plan,
    status: 'active',
    currentPeriodEnd: computePeriodEndIso(now),
  })

  if (error) {
    console.error('Error persistiendo la suscripción:', error)
    return { handled: true, activated: false, reason: 'error persistiendo la suscripción' }
  }

  return { handled: true, activated: true, reason: 'suscripción activada/renovada' }
}
