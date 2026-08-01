import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { UserProvider } from '../UserContext'
import { HouseholdProvider, useHousehold } from '../HouseholdContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const ACTIVE_LINK = {
  id: 'household-1',
  user_a_id: 'user-42',
  user_b_id: 'user-7',
  invite_code: 'ABC',
  status: 'active' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  linked_at: '2026-07-02T00:00:00.000Z',
}

function renderHousehold() {
  return renderHook(() => useHousehold(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <UserProvider>
        <HouseholdProvider>{children}</HouseholdProvider>
      </UserProvider>
    ),
  })
}

describe('HouseholdContext (Fase 1f)', () => {
  beforeEach(() => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        user: { id: 'user-42', email: 'a@b.com' },
        tableResults: {
          household_links: { data: [ACTIVE_LINK], error: null },
        },
        rpcResults: {
          get_household_partner_email: { data: 'pareja@b.com', error: null },
        },
      })
    )
  })

  it('cachea el link activo y el email de la pareja consultando una sola vez', async () => {
    const { result } = renderHousehold()

    await waitFor(() => expect(result.current.link?.id).toBe('household-1'))
    expect(result.current.householdId).toBe('household-1')
    expect(result.current.partnerEmail).toBe('pareja@b.com')

    // El link se pide una sola vez al montar, no por cada consumidor.
    expect(supabaseMock.from).toHaveBeenCalledTimes(1)
    expect(supabaseMock.from).toHaveBeenCalledWith('household_links')
    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_household_partner_email', { p_household_id: 'household-1' })
  })

  it('sin hogar vinculado, householdId y partnerEmail quedan en null', async () => {
    Object.assign(supabaseMock, createSupabaseMock({ user: { id: 'user-42', email: 'a@b.com' } }))

    const { result } = renderHousehold()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.link).toBeNull()
    expect(result.current.householdId).toBeNull()
    expect(result.current.partnerEmail).toBeNull()
  })

  it('si el link está pendiente, no expone householdId (no hay hogar activo)', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        user: { id: 'user-42', email: 'a@b.com' },
        tableResults: {
          household_links: {
            data: [{ ...ACTIVE_LINK, id: 'hh-pending', status: 'pending', linked_at: null }],
            error: null,
          },
        },
      })
    )

    const { result } = renderHousehold()

    await waitFor(() => expect(result.current.link?.id).toBe('hh-pending'))
    expect(result.current.householdId).toBeNull()
  })

  it('se reinicia al desloguear y vuelve a cargar al loguear', async () => {
    const { result } = renderHousehold()

    await waitFor(() => expect(result.current.householdId).toBe('household-1'))

    await act(async () => {
      supabaseMock._emitAuthStateChange('SIGNED_OUT', null)
    })

    expect(result.current.householdId).toBeNull()
    expect(result.current.link).toBeNull()
  })
})
