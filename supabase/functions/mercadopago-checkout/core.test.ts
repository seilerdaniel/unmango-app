import { describe, it, expect } from 'vitest'
import {
  isSupportedPlan,
  getPlanPrice,
  buildExternalReference,
  parseExternalReference,
  buildPreapprovalPayload,
  PLAN_DEFAULT_PRICES_ARS,
} from '../mercadopago-checkout/core'

describe('mercadopago-checkout/core — planes y precios', () => {
  it('isSupportedPlan acepta solo pro y hogar', () => {
    expect(isSupportedPlan('pro')).toBe(true)
    expect(isSupportedPlan('hogar')).toBe(true)
    expect(isSupportedPlan('free')).toBe(false)
    expect(isSupportedPlan('')).toBe(false)
    expect(isSupportedPlan(undefined)).toBe(false)
    expect(isSupportedPlan(null)).toBe(false)
  })

  it('getPlanPrice usa los defaults ARS', () => {
    expect(getPlanPrice('pro')).toBe(PLAN_DEFAULT_PRICES_ARS.pro)
    expect(getPlanPrice('hogar')).toBe(PLAN_DEFAULT_PRICES_ARS.hogar)
    expect(PLAN_DEFAULT_PRICES_ARS.pro).toBeGreaterThan(0)
    expect(PLAN_DEFAULT_PRICES_ARS.hogar).toBeGreaterThan(PLAN_DEFAULT_PRICES_ARS.pro)
  })

  it('getPlanPrice respeta overrides válidos y descarta inválidos', () => {
    expect(getPlanPrice('pro', { pro: 15000 })).toBe(15000)
    expect(getPlanPrice('pro', { pro: NaN })).toBe(PLAN_DEFAULT_PRICES_ARS.pro)
    expect(getPlanPrice('pro', { pro: 0 })).toBe(PLAN_DEFAULT_PRICES_ARS.pro)
    expect(getPlanPrice('hogar', { hogar: 40000 })).toBe(40000)
  })
})

describe('mercadopago-checkout/core — external_reference', () => {
  it('buildExternalReference genera el formato esperado', () => {
    expect(buildExternalReference('user-1', 'pro')).toBe('unmango_user-1_pro')
    expect(buildExternalReference('user-42', 'hogar')).toBe('unmango_user-42_hogar')
  })

  it('parseExternalReference recupera userId y plan', () => {
    expect(parseExternalReference('unmango_user-1_pro')).toEqual({ userId: 'user-1', plan: 'pro' })
    expect(parseExternalReference('unmango_abc123_hogar')).toEqual({ userId: 'abc123', plan: 'hogar' })
  })

  it('parseExternalReference devuelve null para refs inválidas', () => {
    expect(parseExternalReference(null)).toBeNull()
    expect(parseExternalReference(undefined)).toBeNull()
    expect(parseExternalReference('')).toBeNull()
    expect(parseExternalReference('unmango_user-1_free')).toBeNull()
    expect(parseExternalReference('otra_cosa')).toBeNull()
    expect(parseExternalReference('unmango_user-1_pro_extra')).toBeNull()
  })
})

describe('mercadopago-checkout/core — payload del preapproval', () => {
  it('arma la suscripción mensual recurrente en ARS', () => {
    const payload = buildPreapprovalPayload({
      userId: 'user-1',
      plan: 'pro',
      priceArs: 12000,
      payerEmail: 'test@example.com',
      appUrl: 'https://unmango.app',
      webhookUrl: 'https://xxx.supabase.co/functions/v1/mercadopago-webhook',
    })

    expect(payload.reason).toBe('UnMango PRO')
    expect(payload.external_reference).toBe('unmango_user-1_pro')
    expect(payload.payer_email).toBe('test@example.com')
    expect(payload.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 12000,
      currency_id: 'ARS',
    })
    expect(payload.notification_url).toContain('mercadopago-webhook')
    expect(payload.back_url).toContain('?payment=success&plan=pro')
    expect(payload.metadata).toEqual({ userId: 'user-1', plan: 'pro' })
  })

  it('arma el payload del plan hogar con su precio', () => {
    const payload = buildPreapprovalPayload({
      userId: 'u2',
      plan: 'hogar',
      priceArs: 35000,
      payerEmail: 'a@b.com',
      appUrl: 'https://unmango.app',
      webhookUrl: 'https://xxx.supabase.co/functions/v1/mercadopago-webhook',
    })
    expect(payload.reason).toBe('UnMango HOGAR')
    expect(payload.external_reference).toBe('unmango_u2_hogar')
    expect(payload.auto_recurring.transaction_amount).toBe(35000)
  })
})
