'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { Subscription } from '@/types'
import { getUserPlan, Plan } from '@/lib/subscription'

interface SubscriptionContextType {
  /** Fila de subscriptions del usuario, o null si no tiene (→ plan free). */
  subscription: Subscription | null
  /** Plan efectivo (getUserPlan): free sin fila en la tabla. */
  plan: Plan
  loading: boolean
  /** Vuelve a consultar la suscripción (tras cambiar de plan, etc.). */
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

/**
 * Carga la suscripción del usuario una sola vez (mismo criterio que
 * HouseholdContext / PaymentDetailsContext, AUDIT.md Fase 1f) para que
 * PricingModal, WalletManager y el badge del header no repitan la
 * consulta. Sin fila en `subscriptions`, `plan` queda 'free'.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!user) {
        if (mounted) {
          setSubscription(null)
          setLoading(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (mounted) setSubscription(data ?? null)
      } catch (err) {
        console.error('Error cargando la suscripción:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!error) setSubscription(data ?? null)
  }, [user])

  return (
    <SubscriptionContext.Provider value={{ subscription, plan: getUserPlan(subscription), loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error('useSubscription debe usarse dentro de un SubscriptionProvider')
  }
  return context
}
