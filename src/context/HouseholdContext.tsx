'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { HouseholdLink as HouseholdLinkType } from '@/types'

interface HouseholdContextType {
  link: HouseholdLinkType | null
  /** id del link activo (null si no hay hogar vinculado o está pendiente). */
  householdId: string | null
  partnerEmail: string | null
  loading: boolean
  refresh: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

/**
 * Cachea la relación de hogar del usuario (el último household_link más la
 * RPC del email de la pareja) para que HouseholdExpenses, HouseholdLink y
 * FinancialAdviceWidget no hagan cada uno la misma secuencia de llamadas
 * encadenadas (getUser → link → email) al montarse. Acá se resuelve una
 * sola vez y se mantiene sincronizada con la sesión (ver AUDIT.md, Fase 1f).
 */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser()
  const [link, setLink] = useState<HouseholdLinkType | null>(null)
  const [partnerEmail, setPartnerEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setLink(null)
      setPartnerEmail(null)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('household_links')
        .select('*')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setLink(data)

      if (data && data.status === 'active') {
        const { data: email } = await supabase.rpc('get_household_partner_email', { p_household_id: data.id })
        setPartnerEmail(email)
      } else {
        setPartnerEmail(null)
      }
    } catch (err) {
      console.error('Error cargando el vínculo de hogar:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    setLoading(userLoading)
    if (!userLoading) refresh()
  }, [userLoading, refresh])

  const householdId = link?.status === 'active' ? link.id : null

  return (
    <HouseholdContext.Provider value={{ link, householdId, partnerEmail, loading, refresh }}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold debe ser usado dentro de un HouseholdProvider')
  }
  return context
}
