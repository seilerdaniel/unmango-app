'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { WalletWithBalance } from '@/types'

interface WalletsContextType {
  wallets: WalletWithBalance[]
  totalBalance: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WalletsContext = createContext<WalletsContextType | undefined>(undefined)

/**
 * Fuente única de verdad para las billeteras del usuario (lista + saldos
 * calculados por la RPC get_wallet_balances). Antes cada componente
 * (WalletCarousel, WalletManager, TransactionForm, RecurringManager,
 * ImportTransactions, VoiceExpenseInput) repetía la misma carga al
 * montar; ahora leen de acá y `refresh()` se llama después de cualquier
 * alta/baja/edición (ver AUDIT.md, refactor #2).
 */
export function WalletsProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([])
  const [totalBalance, setTotalBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setWallets([])
        setTotalBalance(0)
        return
      }

      const [{ data: walletsData, error: walletsError }, { data: balancesData, error: balancesError }] =
        await Promise.all([
          supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.rpc('get_wallet_balances'),
        ])

      if (walletsError) throw walletsError
      if (balancesError) throw balancesError

      const balanceByWallet: Record<string, number> = {}
      for (const row of balancesData ?? []) {
        balanceByWallet[row.wallet_id] = Number(row.balance) || 0
      }

      const combined: WalletWithBalance[] = (walletsData ?? []).map((w) => ({
        ...w,
        balance: balanceByWallet[w.id] ?? (Number(w.initial_balance) || 0),
      }))

      setWallets(combined)
      setTotalBalance(combined.reduce((acc, w) => acc + w.balance, 0))
      setError(null)
    } catch (err) {
      console.error('Error cargando billeteras:', err)
      setError('No se pudieron cargar las billeteras.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <WalletsContext.Provider value={{ wallets, totalBalance, loading, error, refresh }}>
      {children}
    </WalletsContext.Provider>
  )
}

export function useWallets() {
  const context = useContext(WalletsContext)
  if (!context) {
    throw new Error('useWallets debe ser usado dentro de un WalletsProvider')
  }
  return context
}
