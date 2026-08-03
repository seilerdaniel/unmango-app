import React from 'react'
import { UserProvider } from '@/context/UserContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { PaymentDetailsProvider } from '@/context/PaymentDetailsContext'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { ToastProvider } from '@/context/ToastContext'

/**
 * Wrapper mínimo para tests de componentes que ahora consumen `useUser()`
 * (UserContext), `useHousehold()` (HouseholdContext), `usePaymentDetails()`
 * (PaymentDetailsContext) y `useToast()` (ToastContext). UserProvider
 * resuelve la sesión a partir del mock de supabase
 * (supabaseMock.auth.getSession/getUser/onAuthStateChange), HouseholdProvider
 * cachea el link de hogar, PaymentDetailsProvider los datos de cobro y
 * SubscriptionProvider la fila de `subscriptions` (sin fila → plan free).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <HouseholdProvider>
        <PaymentDetailsProvider>
          <SubscriptionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SubscriptionProvider>
        </PaymentDetailsProvider>
      </HouseholdProvider>
    </UserProvider>
  )
}
