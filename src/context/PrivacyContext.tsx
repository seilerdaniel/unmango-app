'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface PrivacyContextType {
  isPrivate: boolean
  togglePrivacy: () => void
  formatAmount: (amount: number, currencySymbol?: string) => string
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState<boolean>(false)

  // Cargar preferencia guardada en localStorage
  useEffect(() => {
    const savedPrivacy = localStorage.getItem('unmango_privacy_mode')
    if (savedPrivacy !== null) {
      setIsPrivate(JSON.parse(savedPrivacy))
    }
  }, [])

  const togglePrivacy = () => {
    setIsPrivate((prev) => {
      const newValue = !prev
      localStorage.setItem('unmango_privacy_mode', JSON.stringify(newValue))
      return newValue
    })
  }

  // Helper para formatear u ocultar montos
  const formatAmount = (amount: number, currencySymbol: string = '$') => {
    if (isPrivate) {
      return `${currencySymbol} ••••••`
    }
    return `${currencySymbol} ${amount.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy, formatAmount }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error('usePrivacy debe ser usado dentro de un PrivacyProvider')
  }
  return context
}