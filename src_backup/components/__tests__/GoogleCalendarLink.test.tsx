import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoogleCalendarLink from '../GoogleCalendarLink'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

beforeEach(() => {
  Object.assign(supabaseMock, createSupabaseMock())
})

function renderLink(overrides: Parameters<typeof createSupabaseMock>[0] = {}) {
  Object.assign(supabaseMock, createSupabaseMock(overrides))
  return render(
    <AppProviders>
      <GoogleCalendarLink />
    </AppProviders>
  )
}

async function waitForConnectionCheck() {
  await waitFor(() => expect(supabaseMock._fromCalls).toContain('google_calendar_tokens'))
}

describe('GoogleCalendarLink — manejo de errores', () => {
  it('muestra el estado "Conectar" cuando no hay token guardado', async () => {
    renderLink()
    await waitForConnectionCheck()
    expect(screen.getByRole('button', { name: /conectar google calendar/i })).toBeInTheDocument()
  })

  it('muestra un mensaje de guía si la sincronización falla porque no está conectado', async () => {
    const invokeMock = vi.fn(async () => ({
      data: null,
      error: new Error('Edge Function returned a non-2xx status code: 400'),
    }))
    renderLink({
      tableResults: {
        google_calendar_tokens: { data: [{ id: 'token-1' }], error: null },
      },
      functions: { invoke: invokeMock },
    })
    await waitForConnectionCheck()

    await userEvent.click(screen.getByRole('button', { name: /sincronizar ahora/i }))

    expect(await screen.findByText(/no está conectado/i)).toBeInTheDocument()
    expect(invokeMock).toHaveBeenCalledWith('sync-google-calendar', { method: 'POST' })
  })

  it('muestra un mensaje transitorio si la Edge Function falla (no crashea)', async () => {
    const invokeMock = vi.fn(async () => ({
      data: null,
      error: new Error('FunctionsFetchError: network error'),
    }))
    renderLink({
      tableResults: {
        google_calendar_tokens: { data: [{ id: 'token-1' }], error: null },
      },
      functions: { invoke: invokeMock },
    })
    await waitForConnectionCheck()

    await userEvent.click(screen.getByRole('button', { name: /sincronizar ahora/i }))

    expect(await screen.findByText(/verificá la conexión a internet/i)).toBeInTheDocument()
  })

  it('muestra el conteo sincronizado cuando la Edge Function responde OK', async () => {
    const invokeMock = vi.fn(async () => ({ data: { synced: 3 }, error: null }))
    renderLink({
      tableResults: {
        google_calendar_tokens: { data: [{ id: 'token-1' }], error: null },
      },
      functions: { invoke: invokeMock },
    })
    await waitForConnectionCheck()

    await userEvent.click(screen.getByRole('button', { name: /sincronizar ahora/i }))

    expect(await screen.findByText(/sincronizado: 3/i)).toBeInTheDocument()
  })
})
