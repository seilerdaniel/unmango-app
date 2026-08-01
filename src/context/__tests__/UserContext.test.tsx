import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { UserProvider, useUser } from '../UserContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function renderUser() {
  return renderHook(() => useUser(), {
    wrapper: ({ children }: { children: React.ReactNode }) => <UserProvider>{children}</UserProvider>,
  })
}

describe('UserContext (Fase 1f)', () => {
  beforeEach(() => {
    Object.assign(supabaseMock, createSupabaseMock({ user: { id: 'user-42', email: 'a@b.com' } }))
  })

  it('expone el user resuelto por getUser al montar', async () => {
    const { result } = renderUser()

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.user?.id).toBe('user-42'))
    expect(result.current.loading).toBe(false)
  })

  it('llama a getSession y getUser UNA sola vez al montar (sesión cacheada, no duplicada)', async () => {
    renderUser()

    await waitFor(() => expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(1))
    expect(supabaseMock.auth.getSession).toHaveBeenCalledTimes(1)
    expect(supabaseMock.auth.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('se sincroniza con onAuthStateChange: al desloguear el user pasa a null', async () => {
    const { result } = renderUser()

    await waitFor(() => expect(result.current.user?.id).toBe('user-42'))

    await act(async () => {
      supabaseMock._emitAuthStateChange('SIGNED_OUT', null)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })

  it('se sincroniza con onAuthStateChange: un login nuevo actualiza el user', async () => {
    const { result } = renderUser()

    await waitFor(() => expect(result.current.user?.id).toBe('user-42'))

    const newSession = {
      user: { id: 'user-99', email: 'nuevo@b.com' },
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: 0,
    }
    await act(async () => {
      supabaseMock._emitAuthStateChange('SIGNED_IN', newSession)
    })

    expect(result.current.user?.id).toBe('user-99')
    expect(result.current.session).toEqual(newSession)
  })

  it('refreshUser vuelve a pedir la sesión y actualiza el estado', async () => {
    const { result } = renderUser()

    await waitFor(() => expect(result.current.user?.id).toBe('user-42'))

    // Un refresh que encuentra un usuario distinto (simula sesión renovada).
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-77', email: 'otro@c.com' } },
      error: null,
    })

    await act(async () => {
      await result.current.refreshUser()
    })

    expect(result.current.user?.id).toBe('user-77')
  })

  it('si getUser falla, user queda en null sin errores de runtime', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabaseMock.auth.getUser.mockRejectedValueOnce(new Error('red'))
    supabaseMock.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null })

    const { result } = renderUser()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    consoleSpy.mockRestore()
  })
})
