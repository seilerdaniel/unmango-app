import { describe, it, expect } from 'vitest'
import {
  isSupportedPlan,
  getPlanPriceCents,
  buildPriceCreateParams,
  buildCheckoutSessionParams,
  PLAN_PRICES_USD_CENTS,
  STRIPE_API_BASE,
} from '../stripe-checkout/core'

describe('stripe-checkout/core — planes y precios USD', () => {
  it('isSupportedPlan acepta solo pro y hogar', () => {
    expect(isSupportedPlan('pro')).toBe(true)
    expect(isSupportedPlan('hogar')).toBe(true)
    expect(isSupportedPlan('free')).toBe(false)
    expect(isSupportedPlan('')).toBe(false)
    expect(isSupportedPlan(undefined)).toBe(false)
    expect(isSupportedPlan(null)).toBe(false)
  })

  it('getPlanPriceCents devuelve el precio en centavos de USD', () => {
    expect(PLAN_PRICES_USD_CENTS).toEqual({ pro: 999, hogar: 2999 })
    expect(getPlanPriceCents('pro')).toBe(999)
    expect(getPlanPriceCents('hogar')).toBe(2999)
  })

  it('STRIPE_API_BASE apunta a la API pública de Stripe', () => {
    expect(STRIPE_API_BASE).toBe('https://api.stripe.com')
  })
})

describe('stripe-checkout/core — buildPriceCreateParams', () => {
  it('arma el Price mensual de PRO en USD', () => {
    expect(buildPriceCreateParams('pro')).toEqual({
      currency: 'usd',
      unit_amount: 999,
      recurring: { interval: 'month' },
      product_data: { name: 'UnMango PRO' },
      metadata: { plan: 'pro' },
    })
  })

  it('arma el Price mensual de HOGAR en USD', () => {
    expect(buildPriceCreateParams('hogar')).toEqual({
      currency: 'usd',
      unit_amount: 2999,
      recurring: { interval: 'month' },
      product_data: { name: 'UnMango HOGAR' },
      metadata: { plan: 'hogar' },
    })
  })
})

describe('stripe-checkout/core — buildCheckoutSessionParams', () => {
  it('arma una Checkout Session de suscripción con la referencia del usuario', () => {
    const params = buildCheckoutSessionParams({
      plan: 'pro',
      priceId: 'price_ABC',
      userId: 'user-1',
      customerEmail: 'test@example.com',
      appUrl: 'https://unmango.app',
    })

    expect(params.mode).toBe('subscription')
    expect(params.customer_email).toBe('test@example.com')
    expect(params.client_reference_id).toBe('user-1')
    expect(params.metadata).toEqual({ plan: 'pro', userId: 'user-1' })
    expect(params.subscription_data.metadata).toEqual({ plan: 'pro', userId: 'user-1' })
    expect(params.line_items).toEqual([{ price: 'price_ABC', quantity: 1 }])
    expect(params.success_url).toBe('https://unmango.app?payment=success&plan=pro')
    expect(params.cancel_url).toBe('https://unmango.app?payment=canceled&plan=pro')
  })

  it('arma la sesión del plan hogar con su Price', () => {
    const params = buildCheckoutSessionParams({
      plan: 'hogar',
      priceId: 'price_HOG',
      userId: 'user-9',
      customerEmail: 'a@b.com',
      appUrl: 'https://unmango.app',
    })
    expect(params.metadata).toEqual({ plan: 'hogar', userId: 'user-9' })
    expect(params.subscription_data.metadata).toEqual({ plan: 'hogar', userId: 'user-9' })
    expect(params.line_items[0]).toEqual({ price: 'price_HOG', quantity: 1 })
    expect(params.success_url).toContain('plan=hogar')
  })
})
