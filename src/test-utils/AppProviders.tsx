import React from 'react'
import { UserProvider } from '@/context/UserContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { PaymentDetailsProvider } from '@/context/PaymentDetailsContext'
import { ToastProvider } from '@/context/ToastContext'

/**
 * Wrapper mínimo para tests de componentes que ahora consumen `useUser()`
 * (UserContext), `useHousehold()` (HouseholdContext), `usePaymentDetails()`
 * (PaymentDetailsContext) y `useToast()` (ToastContext). UserProvider
 * resuelve la sesión a partir del mock de supabase
 * (supabaseMock.auth.getSession/getUser/onAuthStateChange), HouseholdProvider
 * cachea el link de hogar y PaymentDetailsProvider los datos de cobro.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <HouseholdProvider>
        <PaymentDetailsProvider>
          <ToastProvider>{children}</ToastProvider>
        </PaymentDetailsProvider>
      </HouseholdProvider>
    </UserProvider>
  )
}
