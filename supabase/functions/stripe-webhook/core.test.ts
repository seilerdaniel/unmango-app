import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  parseStripeSignatureHeader,
  buildSignedPayload,
  computeHmacSha256Hex,
  timingSafeEqualHex,
  isTimestampRecent,
  verifyStripeSignature,
  unixSecondsToIso,
  computePeriodEndIso,
  isSupportedPlan,
  isHandledEventType,
  extractSubscriptionData,
  processStripeEvent,
  HANDLED_EVENT_TYPES,
  type WebhookDeps,
} from '../stripe-webhook/core'

const WEBHOOK_SECRET = 'whsec_test_secret'

function nodeHmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Construye un header Stripe-Signature válido para `rawBody` con `t`. */
function buildHeader(rawBody: string, timestamp: number, secret = WEBHOOK_SECRET): string {
  const signature = nodeHmacHex(secret, buildSignedPayload(timestamp, rawBody))
  return `t=${timestamp},v1=${signature}`
}

describe('stripe-webhook/core — verificación de firma', () => {
  const RAW_BODY = '{"type":"checkout.session.completed","data":{}}'
  const TIMESTAMP = 1621123456

  it('parsea el header Stripe-Signature', () => {
    const header = buildHeader(RAW_BODY, TIMESTAMP)
    expect(parseStripeSignatureHeader(header)).toEqual({
      timestamp: TIMESTAMP,
      signatures: [nodeHmacHex(WEBHOOK_SECRET, `${TIMESTAMP}.${RAW_BODY}`)],
    })
  })

  it('parsea un header con varias firmas y descarta v0', () => {
    const header = `t=${TIMESTAMP},v0=old,v1=${nodeHmacHex(WEBHOOK_SECRET, `${TIMESTAMP}.${RAW_BODY}`)}`
    const parsed = parseStripeSignatureHeader(header)
    expect(parsed).not.toBeNull()
    expect(parsed!.signatures).toHaveLength(1)
  })

  it('devuelve null sin header, sin timestamp o sin firma v1', () => {
    expect(parseStripeSignatureHeader(null)).toBeNull()
    expect(parseStripeSignatureHeader('')).toBeNull()
    expect(parseStripeSignatureHeader('t=1621123456')).toBeNull()
    expect(parseStripeSignatureHeader('v1=abc')).toBeNull()
    expect(parseStripeSignatureHeader('t=abc,v1=abc')).toBeNull()
  })

  it('computeHmacSha256Hex coincide con node:crypto', async () => {
    const payload = buildSignedPayload(TIMESTAMP, RAW_BODY)
    expect(await computeHmacSha256Hex(WEBHOOK_SECRET, payload)).toBe(nodeHmacHex(WEBHOOK_SECRET, payload))
  })

  it('buildSignedPayload arma "t.body"', () => {
    expect(buildSignedPayload(123, 'abc')).toBe('123.abc')
  })

  it('timingSafeEqualHex compara en tiempo constante', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true)
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false)
    expect(timingSafeEqualHex('abc', 'abcd')).toBe(false)
  })

  it('isTimestampRecent acepta timestamps recientes y rechaza viejos o futuros', () => {
    const now = new Date('2026-08-02T12:00:00.000Z')
    expect(isTimestampRecent(now.getTime() / 1000 - 60, now)).toBe(true)
    expect(isTimestampRecent(now.getTime() / 1000 + 60, now)).toBe(false)
    expect(isTimestampRecent(now.getTime() / 1000 - 3600, now)).toBe(false)
  })

  it('verifyStripeSignature acepta una firma correcta', async () => {
    const header = buildHeader(RAW_BODY, TIMESTAMP)
    const result = await verifyStripeSignature({
      rawBody: RAW_BODY,
      sigHeader: header,
      webhookSecret: WEBHOOK_SECRET,
      now: new Date((TIMESTAMP + 60) * 1000),
    })
    expect(result).toEqual({ ok: true })
  })

  it('rechaza una firma incorrecta', async () => {
    const result = await verifyStripeSignature({
      rawBody: RAW_BODY,
      sigHeader: `t=${TIMESTAMP},v1=deadbeef`,
      webhookSecret: WEBHOOK_SECRET,
      now: new Date((TIMESTAMP + 60) * 1000),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('no coincide')
  })

  it('rechaza un header ausente o inválido', async () => {
    const result = await verifyStripeSignature({
      rawBody: RAW_BODY,
      sigHeader: null,
      webhookSecret: WEBHOOK_SECRET,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('inválido')
  })

  it('rechaza timestamps fuera de la ventana', async () => {
    const header = buildHeader(RAW_BODY, TIMESTAMP)
    const result = await verifyStripeSignature({
      rawBody: RAW_BODY,
      sigHeader: header,
      webhookSecret: WEBHOOK_SECRET,
      now: new Date((TIMESTAMP + 3600) * 1000),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('tolerancia')
  })
})

describe('stripe-webhook/core — helpers de mapeo', () => {
  it('unixSecondsToIso convierte segundos a ISO UTC', () => {
    expect(unixSecondsToIso(1621123456)).toBe('2021-05-16T00:04:16.000Z')
    expect(unixSecondsToIso(0)).toBeNull()
    expect(unixSecondsToIso(-5)).toBeNull()
    expect(unixSecondsToIso('123')).toBeNull()
    expect(unixSecondsToIso(undefined)).toBeNull()
  })

  it('computePeriodEndIso suma un mes y evita el desborde', () => {
    expect(computePeriodEndIso(new Date('2026-08-02T12:00:00.000Z'))).toBe('2026-09-02T12:00:00.000Z')
    expect(computePeriodEndIso(new Date('2026-01-31T00:00:00.000Z'))).toBe('2026-02-28T00:00:00.000Z')
    expect(computePeriodEndIso(new Date('2026-12-15T00:00:00.000Z'))).toBe('2027-01-15T00:00:00.000Z')
  })

  it('isSupportedPlan acepta solo pro y hogar', () => {
    expect(isSupportedPlan('pro')).toBe(true)
    expect(isSupportedPlan('hogar')).toBe(true)
    expect(isSupportedPlan('free')).toBe(false)
  })

  it('isHandledEventType conoce los 4 eventos manejados', () => {
    expect(HANDLED_EVENT_TYPES).toEqual([
      'checkout.session.completed',
      'invoice.payment_succeeded',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ])
    expect(isHandledEventType('checkout.session.completed')).toBe(true)
    expect(isHandledEventType('customer.subscription.deleted')).toBe(true)
    expect(isHandledEventType('charge.succeeded')).toBe(false)
    expect(isHandledEventType('payment_intent.succeeded')).toBe(false)
  })

  it('extractSubscriptionData lee userId de client_reference_id y plan de metadata', () => {
    const extracted = extractSubscriptionData({
      client_reference_id: 'user-1',
      metadata: { plan: 'pro' },
      payment_status: 'paid',
      current_period_end: 1621123456,
    })
    expect(extracted).not.toBeNull()
    expect(extracted!.identity).toEqual({ userId: 'user-1', plan: 'pro' })
    expect(extracted!.paymentStatus).toBe('paid')
    expect(extracted!.periodEndIso).toBe('2021-05-16T00:04:16.000Z')
  })

  it('extractSubscriptionData lee userId y plan de subscription_data.metadata', () => {
    const extracted = extractSubscriptionData({
      subscription_data: { metadata: { plan: 'hogar', userId: 'user-9' } },
      status: 'active',
    })
    expect(extracted!.identity).toEqual({ userId: 'user-9', plan: 'hogar' })
    expect(extracted!.status).toBe('active')
  })

  it('extractSubscriptionData lee el período de lines.data[0].period.end (factura)', () => {
    const extracted = extractSubscriptionData({
      metadata: { plan: 'pro', userId: 'user-1' },
      lines: { data: [{ period: { start: 1621123000, end: 1621123456 } }] },
    })
    expect(extracted!.periodEndIso).toBe('2021-05-16T00:04:16.000Z')
  })

  it('extractSubscriptionData devuelve null sin identidad válida', () => {
    expect(extractSubscriptionData({})).toBeNull()
    expect(extractSubscriptionData({ client_reference_id: 'user-1' })).toBeNull()
    expect(extractSubscriptionData({ metadata: { plan: 'free' } })).toBeNull()
  })
})

describe('stripe-webhook/core — processStripeEvent', () => {
  const FIXED_NOW = new Date('2026-08-02T12:00:00.000Z')

  function makeDeps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
    return {
      upsertSubscription: vi.fn(async () => ({ error: null })),
      fetchSubscription: vi.fn(async () => ({})),
      ...overrides,
    }
  }

  function event(type: string, object: Record<string, unknown>): import('../stripe-webhook/core').StripeEvent {
    return { type, data: { object } }
  }

  it('ignora eventos no manejados', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(event('charge.succeeded', {}), deps, FIXED_NOW)
    expect(result.handled).toBe(false)
    expect(result.changed).toBe(false)
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('activa con checkout.session.completed pago', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('checkout.session.completed', {
        client_reference_id: 'user-1',
        metadata: { plan: 'pro' },
        payment_status: 'paid',
      }),
      deps,
      FIXED_NOW
    )

    expect(result).toEqual({ handled: true, changed: true, reason: 'suscripción activada' })
    expect(deps.upsertSubscription).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-09-02T12:00:00.000Z',
    })
  })

  it('no activa si el checkout no está pagado', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('checkout.session.completed', {
        client_reference_id: 'user-1',
        metadata: { plan: 'pro' },
        payment_status: 'unpaid',
      }),
      deps,
      FIXED_NOW
    )
    expect(result.changed).toBe(false)
    expect(result.reason).toContain('no es paid')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('renueva con invoice.payment_succeeded usando el período de la factura', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('invoice.payment_succeeded', {
        subscription: 'sub_123',
        subscription_details: { metadata: { plan: 'hogar', userId: 'user-7' } },
        lines: { data: [{ period: { start: 1621123000, end: 1621123456 } }] },
      }),
      deps,
      FIXED_NOW
    )

    expect(result).toEqual({ handled: true, changed: true, reason: 'suscripción renovada' })
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-7',
        plan: 'hogar',
        status: 'active',
        currentPeriodEnd: '2021-05-16T00:04:16.000Z',
      })
    )
  })

  it('invoice.payment_succeeded consulta la suscripción si el payload no trae metadata', async () => {
    const deps = makeDeps({
      fetchSubscription: vi.fn(async () => ({
        id: 'sub_123',
        metadata: { plan: 'pro', userId: 'user-1' },
        status: 'active',
        current_period_end: 1621123456,
      })),
    })
    const result = await processStripeEvent(
      event('invoice.payment_succeeded', { subscription: 'sub_123' }),
      deps,
      FIXED_NOW
    )

    expect(deps.fetchSubscription).toHaveBeenCalledWith('sub_123')
    expect(result.changed).toBe(true)
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', plan: 'pro', status: 'active' })
    )
  })

  it('no toca nada si el evento no trae userId/plan para mapear', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(event('checkout.session.completed', {}), deps, FIXED_NOW)
    expect(result.changed).toBe(false)
    expect(result.reason).toContain('no trae userId/plan')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('actualiza con customer.subscription.updated activo', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('customer.subscription.updated', {
        metadata: { plan: 'pro', userId: 'user-1' },
        status: 'active',
        current_period_end: 1621123456,
      }),
      deps,
      FIXED_NOW
    )
    expect(result.changed).toBe(true)
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', status: 'active' })
    )
  })

  it('customer.subscription.updated no toca la fila si el status no es active', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('customer.subscription.updated', {
        metadata: { plan: 'pro', userId: 'user-1' },
        status: 'past_due',
      }),
      deps,
      FIXED_NOW
    )
    expect(result.changed).toBe(false)
    expect(result.reason).toContain('no es active')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('cancela con customer.subscription.deleted', async () => {
    const deps = makeDeps()
    const result = await processStripeEvent(
      event('customer.subscription.deleted', {
        metadata: { plan: 'hogar', userId: 'user-3' },
        status: 'canceled',
        current_period_end: 1621123456,
      }),
      deps,
      FIXED_NOW
    )
    expect(result).toEqual({ handled: true, changed: true, reason: 'suscripción cancelada' })
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-3', plan: 'hogar', status: 'canceled' })
    )
  })

  it('reporta si el upsert a subscriptions falla', async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn(async () => ({ error: new Error('RLS') })),
    })
    const result = await processStripeEvent(
      event('checkout.session.completed', {
        client_reference_id: 'user-1',
        metadata: { plan: 'pro' },
        payment_status: 'paid',
      }),
      deps,
      FIXED_NOW
    )
    expect(result.changed).toBe(false)
    expect(result.reason).toContain('persistiendo')
  })
})
