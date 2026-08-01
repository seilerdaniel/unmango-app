import React from 'react'
import { UserProvider } from '@/context/UserContext'
import { HouseholdProvider } from '@/context/HouseholdContext'

/**
 * Wrapper mínimo para tests de componentes que ahora consumen `useUser()`
 * (UserContext) y `useHousehold()` (HouseholdContext). UserProvider resuelve
 * la sesión a partir del mock de supabase (supabaseMock.auth.getSession/
 * getUser/onAuthStateChange) y HouseholdProvider cachea el link de hogar.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <HouseholdProvider>{children}</HouseholdProvider>
    </UserProvider>
  )
}
