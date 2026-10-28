'use client'

import React, { createContext, useContext, useState } from 'react'

interface PrivacyContextType {
  isPrivate: boolean
  togglePrivacy: () => void
  formatAmount: (amount: number, currencyOverride?: 'ARS' | 'USD') => string
  displayCurrency: 'ARS' | 'USD'
  setDisplayCurrency: (currency: 'ARS' | 'USD') => void
  blueRate: number
  setBlueRate: (rate: number) => void
  convertAmount: (amountInARS: number) => number
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // Inicialización directa y perezosa (Lazy State Initialization) para React 19
  const [isPrivate, setIsPrivate] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('unmango_privacy_mode')
    return saved !== null ? saved === 'true' : false
  })

  const [displayCurrency, setDisplayCurrencyState] = useState<'ARS' | 'USD'>(() => {
    if (typeof window === 'undefined') return 'ARS'
    const saved = localStorage.getItem('unmango_display_currency')
    return saved === 'ARS' || saved === 'USD' ? saved : 'ARS'
  })

  const [blueRate, setBlueRate] = useState<number>(1200) // Fallback inicial

  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const nextState = !prev
      localStorage.setItem('unmango_privacy_mode', String(nextState))
      return nextState
    })
  }

  const setDisplayCurrency = (currency: 'ARS' | 'USD') => {
    setDisplayCurrencyState(currency)
    localStorage.setItem('unmango_display_currency', currency)
  }

  const convertAmount = (amountInARS: number) => {
    if (displayCurrency === 'USD') {
      return blueRate > 0 ? amountInARS / blueRate : amountInARS
    }
    return amountInARS
  }

  const formatAmount = (amount: number, currencyOverride?: 'ARS' | 'USD') => {
    if (isPrivate) return '••••••'

    const targetCurrency = currencyOverride || displayCurrency
    const finalAmount = currencyOverride ? amount : convertAmount(amount)

    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: targetCurrency,
      maximumFractionDigits: targetCurrency === 'USD' ? 2 : 0
    }).format(finalAmount)
  }

  return (
    <PrivacyContext.Provider
      value={{
        isPrivate,
        togglePrivacy,
        formatAmount,
        displayCurrency,
        setDisplayCurrency,
        blueRate,
        setBlueRate,
        convertAmount
      }}
    >
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error('usePrivacy debe usarse dentro de un PrivacyProvider')
  }
  return context
}