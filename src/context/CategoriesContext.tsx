'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Category } from '@/types'

interface CategoriesContextType {
  categories: Category[]
  loading: boolean
  error: string | null
  refreshCategories: () => Promise<void>
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined)

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCategories([])
        return
      }

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
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCategories()
  }, [refreshCategories])

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
