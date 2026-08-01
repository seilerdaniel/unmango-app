'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { Category } from '@/types'

interface CategoriesContextType {
  categories: Category[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined)

/**
 * Fuente única de verdad para las categorías del usuario. Usa el user
 * cacheado de UserContext (ver AUDIT.md, Fase 1f) en vez de llamar a
 * `supabase.auth.getUser()` en cada montaje. Se recarga cuando cambia la
 * sesión (login/logout) o al invocar `refreshCategories()`.
 */
export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = useCallback(async () => {
    if (!user) {
      setCategories([])
      setDataLoading(false)
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCategories(data ?? [])
      setError(null)
    } catch (err) {
      console.error('Error cargando categorías:', err)
      setError('No se pudieron cargar las categorías.')
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    // refreshCategories es async; sus setState ocurren post-await, no
    // sincrónicos en el effect (falso positivo de la regla).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!userLoading) refreshCategories()
  }, [userLoading, refreshCategories])

  // loading se deriva: true mientras la sesión se resuelve O mientras
  // los datos se cargan (evita un render extra seteando estado en el
  // effect cuando userLoading cambia).
  const loading = userLoading || dataLoading

  return (
    <CategoriesContext.Provider value={{ categories, loading, error, refreshCategories }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoriesContext)
  if (!context) {
    throw new Error('useCategories debe ser usado dentro de un CategoriesProvider')
  }
  return context
}
