import { describe, it, expect } from 'vitest'
import {
  getUserPlan,
  hasProAccess,
  hasHogarAccess,
  canUseFeature,
  FREE_WALLET_LIMIT,
} from '../subscription'
import type { Subscription } from '@/types'

const SUB: Subscription = {
  id: 'sub-1',
  user_id: 'user-1',
  plan: 'pro',
  status: 'active',
  current_period_end: null,
  updated_at: '2026-08-01T00:00:00.000Z',
}

describe('getUserPlan', () => {
  it('devuelve el plan de la suscripción', () => {
    expect(getUserPlan({ ...SUB, plan: 'pro' })).toBe('pro')
    expect(getUserPlan({ ...SUB, plan: 'hogar' })).toBe('hogar')
    expect(getUserPlan({ ...SUB, plan: 'free' })).toBe('free')
  })

  it('asume free sin fila en subscriptions o con plan desconocido', () => {
    expect(getUserPlan(null)).toBe('free')
    expect(getUserPlan({ ...SUB, plan: 'whatever' as Subscription['plan'] })).toBe('free')
  })
})

describe('hasProAccess / hasHogarAccess', () => {
  it('PRO accede solo a pro; HOGAR incluye pro', () => {
    expect(hasProAccess('pro')).toBe(true)
    expect(hasProAccess('hogar')).toBe(true)
    expect(hasProAccess('free')).toBe(false)
    expect(hasHogarAccess('hogar')).toBe(true)
    expect(hasHogarAccess('pro')).toBe(false)
  })
})

describe('canUseFeature — matriz de permisos por plan', () => {
  const features = ['quickchart', 'tna', 'roundup', 'unlimited_wallets', 'export_pdf'] as const

  it('FREE no tiene ninguna feature de pago', () => {
    for (const f of features) {
      expect(canUseFeature(f, 'free')).toBe(false)
    }
  })

  it('PRO tiene todas las features', () => {
    for (const f of features) {
      expect(canUseFeature(f, 'pro')).toBe(true)
    }
  })

  it('HOGAR hereda todas las features de PRO', () => {
    for (const f of features) {
      expect(canUseFeature(f, 'hogar')).toBe(true)
    }
  })

  it('un plan desconocido se trata como free', () => {
    expect(canUseFeature('tna', 'otro')).toBe(false)
  })

  it('el límite de billeteras del plan FREE es 2', () => {
    expect(FREE_WALLET_LIMIT).toBe(2)
  })
})
