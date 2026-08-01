import React from 'react'
import { UserProvider } from '@/context/UserContext'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { ToastProvider } from '@/context/ToastContext'

/**
 * Wrapper mínimo para tests de componentes que ahora consumen `useUser()`
 * (UserContext), `useHousehold()` (HouseholdContext) y `useToast()`
 * (ToastContext). UserProvider resuelve la sesión a partir del mock de
 * supabase (supabaseMock.auth.getSession/getUser/onAuthStateChange) y
 * HouseholdProvider cachea el link de hogar.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <HouseholdProvider>
        <ToastProvider>{children}</ToastProvider>
      </HouseholdProvider>
    </UserProvider>
  )
}
