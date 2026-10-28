'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'

interface PaymentDetailsContextType {
  /** Alias / CBU / link de Mercado Pago guardado, o '' si no cargó nada. */
  paymentDetails: string
  loading: boolean
  /** Guarda (o borra si se pasa '') los datos de cobro. Resuelve true si ok. */
  save: (details: string) => Promise<boolean>
}

const PaymentDetailsContext = createContext<PaymentDetailsContextType | undefined>(undefined)

/**
 * Cachea los datos de cobro del usuario (alias bancario, CBU o link de
 * Mercado Pago) para que los generadores de tarjetas de WhatsApp
 * (HouseholdExpenses, SplitExpenseTool) y el panel de Configuración
 * (PaymentDetailsSettings) no repitan la consulta por cada consumo —
 * mismo criterio que HouseholdContext (AUDIT.md, Fase 1f). La sesión ya
 * la resuelve UserContext, así que acá solo se hace un select por user.
 */
export function PaymentDetailsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [paymentDetails, setPaymentDetails] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!user) {
        // Sin sesión no hay nada que cargar, pero NO apagamos `loading`:
        // el primer load real (con user) es el que sincroniza a los
        // consumidores, y así evitamos que la UI parpadee con un estado
        // vacío antes de resolverse la sesión.
        if (mounted) setPaymentDetails('')
        return
      }

      try {
        const { data, error } = await supabase
          .from('user_payment_details')
          .select('payment_details')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (mounted) setPaymentDetails(data?.payment_details ?? '')
      } catch (err) {
        console.error('Error cargando datos de cobro:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [user])

  const save = useCallback(
    async (details: string) => {
      if (!user) return false
      const trimmed = details.trim()

      const { error } = await supabase.from('user_payment_details').upsert(
        {
          user_id: user.id,
          payment_details: trimmed || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

      if (error) {
        console.error('Error guardando datos de cobro:', error)
        return false
      }
      setPaymentDetails(trimmed)
      return true
    },
    [user]
  )

  return (
    <PaymentDetailsContext.Provider value={{ paymentDetails, loading, save }}>
      {children}
    </PaymentDetailsContext.Provider>
  )
}

export function usePaymentDetails() {
  const context = useContext(PaymentDetailsContext)
  if (!context) {
    throw new Error('usePaymentDetails debe usarse dentro de un PaymentDetailsProvider')
  }
  return context
}
