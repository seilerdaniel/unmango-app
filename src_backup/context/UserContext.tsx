'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Session, User } from '@supabase/supabase-js'

interface UserContextType {
  user: User | null
  session: Session | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

/**
 * Fuente única de verdad para la sesión de Supabase. Antes cada contexto
 * y componente hacía `supabase.auth.getUser()` por separado al montar
 * (y se repetía en cada navegación), generando requests duplicados.
 *
 * Acá la sesión se resuelve UNA vez al arrancar (getSession + getUser para
 * validar/refrescar el token) y luego se mantiene sincronizada con el
 * listener `onAuthStateChange` (login, logout, refresh de token). Los
 * consumidores leen `user`/`session` del cache en vez de volver a llamar
 * a Supabase (ver AUDIT.md, Fase 1f).
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // getSession resuelve rápido desde el storage local; getUser valida el
    // token contra el server (y lo refresca si hace falta). Ambas se
    // disparan en paralelo: la primera deja la UI usable enseguida y la
    // segunda confirma que la sesión sigue siendo válida.
    supabase.auth.getSession().then(({ data: { session: cachedSession } }) => {
      if (!mountedRef.current) return
      setSession(cachedSession)
      setUser(cachedSession?.user ?? null)
    })

    supabase.auth
      .getUser()
      .then(({ data: { user: currentUser } }) => {
        if (!mountedRef.current) return
        setUser(currentUser)
      })
      .catch(() => {
        if (!mountedRef.current) return
        setUser(null)
      })
      .finally(() => {
        if (!mountedRef.current) return
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mountedRef.current) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser(),
      ])
      if (!mountedRef.current) return
      setSession(sessionData.session)
      setUser(userData.user)
    } catch {
      if (!mountedRef.current) return
      setUser(null)
      setSession(null)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, session, loading, refreshUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser debe ser usado dentro de un UserProvider')
  }
  return context
}
