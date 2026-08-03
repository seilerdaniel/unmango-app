import { describe, it, expect, vi } from 'vitest'
import {
  parseWebhookNotification,
  isHandledWebhookType,
  parseExternalReference,
  computePeriodEndIso,
  shouldActivateForStatus,
  processMercadoPagoNotification,
  HANDLED_WEBHOOK_TYPES,
  type WebhookDeps,
} from '../mercadopago-webhook/core'

describe('mercadopago-webhook/core — parseo de la notificación', () => {
  it('extrae type del query string y el id de data.id (formato IPN)', () => {
    expect(parseWebhookNotification({ data: { id: 'PRE_123' } }, 'preapproval')).toEqual({
      type: 'preapproval',
      resourceId: 'PRE_123',
    })
  })

  it('extrae type del body cuando no viene en el query string', () => {
    expect(parseWebhookNotification({ type: 'payment', data: { id: 'PAY_1' } }, null)).toEqual({
      type: 'payment',
      resourceId: 'PAY_1',
    })
  })

  it('acepta un id en el tope del body (formato de algunas versiones)', () => {
    expect(parseWebhookNotification({ type: 'authorized_payment', id: 'AUTH_9' }, null)).toEqual({
      type: 'authorized_payment',
      resourceId: 'AUTH_9',
    })
  })

  it('devuelve null sin type o sin id', () => {
    expect(parseWebhookNotification({ data: {} }, null)).toBeNull()
    expect(parseWebhookNotification({ type: 'preapproval' }, null)).toBeNull()
    expect(parseWebhookNotification(null, null)).toBeNull()
    expect(parseWebhookNotification({ data: { id: '' } }, 'preapproval')).toBeNull()
  })
})

describe('mercadopago-webhook/core — tipos manejados', () => {
  it('maneja payment, authorized_payment y preapproval', () => {
    expect(HANDLED_WEBHOOK_TYPES).toEqual(['payment', 'authorized_payment', 'preapproval'])
    expect(isHandledWebhookType('preapproval')).toBe(true)
    expect(isHandledWebhookType('authorized_payment')).toBe(true)
    expect(isHandledWebhookType('payment')).toBe(true)
    expect(isHandledWebhookType('merchant_order')).toBe(false)
    expect(isHandledWebhookType('test')).toBe(false)
  })
})

describe('mercadopago-webhook/core — external_reference (duplicado del checkout)', () => {
  it('parsea la ref generada por el checkout', () => {
    expect(parseExternalReference('unmango_user-1_pro')).toEqual({ userId: 'user-1', plan: 'pro' })
    expect(parseExternalReference('unmango_user-9_hogar')).toEqual({ userId: 'user-9', plan: 'hogar' })
  })

  it('rechaza refs inválidas', () => {
    expect(parseExternalReference(null)).toBeNull()
    expect(parseExternalReference('unmango_user_free')).toBeNull()
    expect(parseExternalReference('random')).toBeNull()
  })
})

describe('mercadopago-webhook/core — período de fin', () => {
  it('suma un mes en UTC (misma fecha del mes siguiente)', () => {
    expect(computePeriodEndIso(new Date('2026-08-02T12:00:00.000Z'))).toBe('2026-09-02T12:00:00.000Z')
  })

  it('cruza el fin de año correctamente', () => {
    expect(computePeriodEndIso(new Date('2026-12-15T00:00:00.000Z'))).toBe('2027-01-15T00:00:00.000Z')
  })

  it('evita el desborde de fechas cortas (31 de enero → 28 de febrero)', () => {
    expect(computePeriodEndIso(new Date('2026-01-31T00:00:00.000Z'))).toBe('2026-02-28T00:00:00.000Z')
  })
})

describe('mercadopago-webhook/core — status que activa', () => {
  it('autorizado/aprobado activan; el resto no', () => {
    expect(shouldActivateForStatus('authorized')).toBe(true)
    expect(shouldActivateForStatus('approved')).toBe(true)
    expect(shouldActivateForStatus('pending')).toBe(false)
    expect(shouldActivateForStatus('cancelled')).toBe(false)
    expect(shouldActivateForStatus('paused')).toBe(false)
    expect(shouldActivateForStatus(undefined)).toBe(false)
  })
})

describe('mercadopago-webhook/core — processMercadoPagoNotification', () => {
  const FIXED_NOW = new Date('2026-08-02T12:00:00.000Z')

  function makeDeps(overrides: Partial<WebhookDeps> = {}): WebhookDeps {
    return {
      fetchResource: vi.fn(async () => ({ status: 'authorized', external_reference: 'unmango_user-1_pro' })),
      upsertSubscription: vi.fn(async () => ({ error: null })),
      ...overrides,
    }
  }

  it('ignora eventos no manejados', async () => {
    const deps = makeDeps()
    const result = await processMercadoPagoNotification({ type: 'test', resourceId: 'X' }, deps, FIXED_NOW)
    expect(result.handled).toBe(false)
    expect(result.activated).toBe(false)
    expect(deps.fetchResource).not.toHaveBeenCalled()
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('activa la suscripción con un preapproval autorizado', async () => {
    const deps = makeDeps()
    const result = await processMercadoPagoNotification(
      { type: 'preapproval', resourceId: 'PRE_123' },
      deps,
      FIXED_NOW
    )

    expect(result).toEqual({ handled: true, activated: true, reason: 'suscripción activada/renovada' })
    expect(deps.fetchResource).toHaveBeenCalledWith('preapproval', 'PRE_123')
    expect(deps.upsertSubscription).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-09-02T12:00:00.000Z',
    })
  })

  it('activa con un pago aprobado (payment)', async () => {
    const deps = makeDeps({
      fetchResource: vi.fn(async () => ({ status: 'approved', external_reference: 'unmango_user-7_hogar' })),
    })
    const result = await processMercadoPagoNotification({ type: 'payment', resourceId: 'PAY_1' }, deps, FIXED_NOW)
    expect(result.activated).toBe(true)
    expect(deps.upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-7', plan: 'hogar', status: 'active' })
    )
  })

  it('no activa si el status no está aprobado', async () => {
    const deps = makeDeps({
      fetchResource: vi.fn(async () => ({ status: 'pending', external_reference: 'unmango_user-1_pro' })),
    })
    const result = await processMercadoPagoNotification({ type: 'preapproval', resourceId: 'PRE_123' }, deps, FIXED_NOW)
    expect(result.activated).toBe(false)
    expect(result.reason).toContain('no activa')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('no activa si el recurso no trae external_reference válida', async () => {
    const deps = makeDeps({
      fetchResource: vi.fn(async () => ({ status: 'authorized', external_reference: 'algo_mas' })),
    })
    const result = await processMercadoPagoNotification({ type: 'preapproval', resourceId: 'PRE_123' }, deps, FIXED_NOW)
    expect(result.activated).toBe(false)
    expect(result.reason).toContain('external_reference')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('no activa si no se puede consultar el recurso', async () => {
    const deps = makeDeps({
      fetchResource: vi.fn(async () => {
        throw new Error('MP 404')
      }),
    })
    const result = await processMercadoPagoNotification({ type: 'preapproval', resourceId: 'PRE_123' }, deps, FIXED_NOW)
    expect(result.activated).toBe(false)
    expect(result.reason).toContain('error consultando')
    expect(deps.upsertSubscription).not.toHaveBeenCalled()
  })

  it('reporta si el upsert a subscriptions falla', async () => {
    const deps = makeDeps({
      upsertSubscription: vi.fn(async () => ({ error: new Error('RLS') })),
    })
    const result = await processMercadoPagoNotification({ type: 'preapproval', resourceId: 'PRE_123' }, deps, FIXED_NOW)
    expect(result.activated).toBe(false)
    expect(result.reason).toContain('persistiendo')
  })
})
