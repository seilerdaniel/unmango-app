// Lógica pura de la Edge Function stripe-webhook, sin Deno ni Stripe, para
// poder testearla con Vitest igual que el resto del proyecto (mismo patrón
// que mercadopago-webhook/core.ts).
//
// index.ts (la Edge Function en sí) importa esto y solo agrega la parte de
// red/entorno: leer STRIPE_WEBHOOK_SECRET, verificar la firma
// (Stripe-Signature), parsear el JSON, armar el cliente admin de Supabase
// y mapear la Subscription de Stripe cuando hace falta.
//
// Nota de duplicación: isSupportedPlan y computePeriodEndIso son los mismos
// de stripe-checkout/core.ts y mercadopago-webhook/core.ts, pero cada Edge
// Function se despliega con su propio directorio — no puede importar de
// otra carpeta. Si cambiás el formato, replicá el cambio en ambos lados.

export const STRIPE_API_BASE = 'https://api.stripe.com'

export type CheckoutPlan = 'pro' | 'hogar'

export function isSupportedPlan(plan: string | undefined | null): plan is CheckoutPlan {
  return plan === 'pro' || plan === 'hogar'
}

/**
 * Eventos de Stripe que activan/cancelan/renuevan la suscripción:
 * - checkout.session.completed: primer pago aprobado (crea la fila).
 * - invoice.payment_succeeded: cada cobro mensual (renueva la fila).
 * - customer.subscription.updated: cambio de estado de la suscripción.
 * - customer.subscription.deleted: cancelación (status 'canceled').
 * Otros eventos (charge.*, payment_intent.*, ...) se ignoran respondiendo 200.
 */
export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'invoice.payment_succeeded',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number]

export interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
}

export function isHandledEventType(type: string): type is HandledEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type)
}

// ---------------------------------------------------------------------------
// Verificación de firma (Stripe-Signature)
// ---------------------------------------------------------------------------

/**
 * Parsea el header `Stripe-Signature`:
 * `t=1621123456,v1=...` → { timestamp, signatures } (solo firmas v1).
 * Devuelve null si no hay timestamp o ninguna firma v1.
 */
export function parseStripeSignatureHeader(
  header: string | null
): { timestamp: number; signatures: string[] } | null {
  if (!header) return null
  const parts = header.split(',').map((part) => part.trim()).filter(Boolean)

  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (key === 't') {
      timestamp = Number(value)
    } else if (key === 'v1') {
      signatures.push(value)
    }
  }

  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) return null
  return { timestamp, signatures }
}

/** Payload que se firma: "<timestamp>.<rawBody>". */
export function buildSignedPayload(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`
}

/** HMAC-SHA256 hex del payload con el webhook secret (WebCrypto). */
export async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Comparación de hex en tiempo constante (evita timing attacks). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * El timestamp no puede ser del futuro ni muy viejo (Stripe recomienda
 * rechazar firmas con más de ~5 minutos). Ventana configurable.
 */
export function isTimestampRecent(
  timestamp: number,
  now: Date = new Date(),
  maxAgeSeconds = 300
): boolean {
  const ageSeconds = now.getTime() / 1000 - timestamp
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds
}

export interface SignatureVerification {
  ok: boolean
  reason?: string
}

/**
 * Verifica la firma de un webhook de Stripe (HMAC-SHA256 del payload
 * "t.rawBody" con STRIPE_WEBHOOK_SECRET). Es el equivalente a
 * `stripe.webhooks.constructEvent` pero sin SDK, testeable aislado.
 */
export async function verifyStripeSignature(input: {
  rawBody: string
  sigHeader: string | null
  webhookSecret: string
  now?: Date
  maxAgeSeconds?: number
}): Promise<SignatureVerification> {
  const parsed = parseStripeSignatureHeader(input.sigHeader)
  if (!parsed) {
    return { ok: false, reason: 'header Stripe-Signature inválido o ausente' }
  }
  if (!isTimestampRecent(parsed.timestamp, input.now, input.maxAgeSeconds)) {
    return { ok: false, reason: 'timestamp fuera de la ventana de tolerancia' }
  }
  const payload = buildSignedPayload(parsed.timestamp, input.rawBody)
  const expected = await computeHmacSha256Hex(input.webhookSecret, payload)
  const ok = parsed.signatures.some((signature) => timingSafeEqualHex(signature, expected))
  return ok ? { ok: true } : { ok: false, reason: 'firma no coincide' }
}

// ---------------------------------------------------------------------------
// Mapeo del evento a la tabla subscriptions
// ---------------------------------------------------------------------------

/** Timestamp unix (segundos) de Stripe → ISO UTC. null si es inválido. */
export function unixSecondsToIso(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000).toISOString()
}

/**
 * Fin del período actual: un mes después de `from` (current_period_end se
 * guarda como timestamptz ISO UTC). Clampa a fin de mes para no desbordar
 * (31 de enero → 28/29 de febrero).
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

/**
 * Junta las bolsas de metadata donde podemos dejar el { plan, userId }:
 * `metadata` (suscripciones y sesiones), `subscription_data.metadata` (se
 * setea en stripe-checkout) y `subscription_details.metadata` (facturas de
 * suscripción). El formato de Stripe puede variar según la versión de la
 * API, así que miramos todos lados.
 */
function collectMetadata(obj: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const key of ['metadata', 'subscription_data', 'subscription_details']) {
    const bag = asRecord(obj[key])
    if (!bag) continue
    const inner = key === 'metadata' ? bag : asRecord(bag.metadata)
    if (inner) Object.assign(merged, inner)
  }
  return merged
}

export interface SubscriptionIdentity {
  userId: string
  plan: CheckoutPlan
}

export interface ExtractedSubscriptionData {
  identity: SubscriptionIdentity
  status: string | null
  paymentStatus: string | null
  periodEndIso: string | null
}

/**
 * Extrae de un objeto de Stripe (sesión, suscripción o factura) todo lo que
 * necesitamos para el upsert: { userId, plan } (vía client_reference_id o
 * metadata), status, payment_status y current_period_end (que en las
 * facturas vive en lines.data[0].period.end). Devuelve null si no hay
 * identidad válida.
 */
export function extractSubscriptionData(
  obj: Record<string, unknown>
): ExtractedSubscriptionData | null {
  const metadata = collectMetadata(obj)
  const clientRefId = typeof obj.client_reference_id === 'string' ? obj.client_reference_id : ''
  const userId = clientRefId || (typeof metadata.userId === 'string' ? metadata.userId : '')
  const plan = typeof metadata.plan === 'string' ? metadata.plan : ''
  if (!userId || !isSupportedPlan(plan)) return null

  const status = typeof obj.status === 'string' ? obj.status : null
  const paymentStatus = typeof obj.payment_status === 'string' ? obj.payment_status : null

  let periodEndIso = unixSecondsToIso(obj.current_period_end)
  if (!periodEndIso) {
    const lines = asRecord(obj.lines)
    const firstLine = lines && Array.isArray(lines.data) ? asRecord(lines.data[0]) : null
    const period = firstLine ? asRecord(firstLine.period) : null
    periodEndIso = unixSecondsToIso(period?.end)
  }

  return { identity: { userId, plan }, status, paymentStatus, periodEndIso }
}

export interface WebhookDeps {
  /**
   * Upsert en la tabla subscriptions del usuario. Devuelve { error } como
   * las llamadas de supabase-js.
   */
  upsertSubscription: (input: {
    userId: string
    plan: CheckoutPlan
    status: 'active' | 'canceled'
    currentPeriodEnd: string
  }) => Promise<{ error: unknown }>
  /**
   * Trae la Subscription de la API de Stripe por id (opcional). Se usa como
   * fallback en invoice.payment_succeeded, cuyo payload no siempre trae la
   * metadata de la suscripción. Tira si la API no responde OK.
   */
  fetchSubscription?: (subscriptionId: string) => Promise<Record<string, unknown>>
}

export interface ProcessResult {
  handled: boolean
  changed: boolean
  reason: string
}

/**
 * Procesa un evento de Stripe y lo refleja en la tabla `subscriptions`:
 * - checkout.session.completed: pago inicial → status 'active'.
 * - invoice.payment_succeeded: cobro mensual → renueva 'active'.
 * - customer.subscription.updated: solo actualiza si status === 'active'
 *   (pagos al día); un past_due/unpaid no toca la fila.
 * - customer.subscription.deleted: cancela → status 'canceled'.
 *
 * current_period_end sale del evento (suscripción o línea de factura) y si
 * no viene, cae a ahora + 30 días. Idempotente: un evento reprocesado
 * (Stripe reintenta hasta que respondamos 200) hace el mismo upsert.
 */
export async function processStripeEvent(
  event: StripeEvent,
  deps: WebhookDeps,
  now: Date = new Date()
): Promise<ProcessResult> {
  if (!isHandledEventType(event.type)) {
    return { handled: false, changed: false, reason: `evento no manejado (${event.type})` }
  }

  const obj = asRecord(event.data?.object) ?? {}
  let extracted = extractSubscriptionData(obj)

  // invoice.payment_succeeded no trae client_reference_id ni la metadata de
  // la suscripción en el payload (la sub vive en el objeto Subscription).
  // Si no pudimos identificar, la consultamos en Stripe — que es justo donde
  // stripe-checkout copió el { plan, userId } vía subscription_data.metadata.
  if (!extracted && event.type === 'invoice.payment_succeeded' && deps.fetchSubscription) {
    const subscriptionId = typeof obj.subscription === 'string' ? obj.subscription : null
    if (subscriptionId) {
      let subscription: Record<string, unknown> | null = null
      try {
        subscription = await deps.fetchSubscription(subscriptionId)
      } catch (err) {
        console.error('Error consultando la suscripción en Stripe:', err)
      }
      if (subscription) extracted = extractSubscriptionData(subscription)
    }
  }

  if (!extracted) {
    return { handled: true, changed: false, reason: 'el evento no trae userId/plan para mapear' }
  }

  const currentPeriodEnd = extracted.periodEndIso ?? computePeriodEndIso(now)

  if (event.type === 'customer.subscription.deleted') {
    const { error } = await deps.upsertSubscription({
      userId: extracted.identity.userId,
      plan: extracted.identity.plan,
      status: 'canceled',
      currentPeriodEnd,
    })
    if (error) {
      console.error('Error persistiendo la suscripción:', error)
      return { handled: true, changed: false, reason: 'error persistiendo la suscripción' }
    }
    return { handled: true, changed: true, reason: 'suscripción cancelada' }
  }

  if (event.type === 'customer.subscription.updated') {
    if (extracted.status !== 'active') {
      return {
        handled: true,
        changed: false,
        reason: `status "${extracted.status ?? 'desconocido'}" no es active, no se actualiza`,
      }
    }
  }

  if (event.type === 'checkout.session.completed' && extracted.paymentStatus !== 'paid') {
    return {
      handled: true,
      changed: false,
      reason: `payment_status "${extracted.paymentStatus ?? 'desconocido'}" no es paid`,
    }
  }

  const { error } = await deps.upsertSubscription({
    userId: extracted.identity.userId,
    plan: extracted.identity.plan,
    status: 'active',
    currentPeriodEnd,
  })

  if (error) {
    console.error('Error persistiendo la suscripción:', error)
    return { handled: true, changed: false, reason: 'error persistiendo la suscripción' }
  }

  return {
    handled: true,
    changed: true,
    reason:
      event.type === 'checkout.session.completed'
        ? 'suscripción activada'
        : 'suscripción renovada',
  }
}
