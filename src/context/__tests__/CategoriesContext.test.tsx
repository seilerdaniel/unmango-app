import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CategoriesProvider, useCategories } from '../CategoriesContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function Probe() {
  const { categories, loading } = useCategories()
  if (loading) return <p>cargando</p>
  return (
    <ul>
      {categories.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  )
}

describe('CategoriesContext (regresión Fase 1)', () => {
  beforeEach(() => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        user: { id: 'user-42', email: 'a@b.com' },
        tableResults: {
          categories: { data: [{ id: 'c1', user_id: 'user-42', name: 'Comida', color: '#111' }], error: null },
        },
      })
    )
  })

  it('filtra explícitamente por user_id al pedir categorías (defensa en profundidad además de RLS)', async () => {
    render(
      <AppProviders>
        <CategoriesProvider>
          <Probe />
        </CategoriesProvider>
      </AppProviders>
    )

    await waitFor(() => expect(screen.getByText('Comida')).toBeInTheDocument())

    const categoriesCallIndex = supabaseMock._fromCalls.lastIndexOf('categories')
    const builder = supabaseMock.from.mock.results[categoriesCallIndex].value

    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-42')
  })
})
