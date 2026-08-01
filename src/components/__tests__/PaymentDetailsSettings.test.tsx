import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PaymentDetailsSettings from '../PaymentDetailsSettings'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock, makeQueryBuilder } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function baseConfig() {
  return createSupabaseMock({
    user: { id: 'user-1', email: 'me@b.com' },
    tableResults: {
      user_payment_details: {
        data: [{ user_id: 'user-1', payment_details: 'juan.perez', updated_at: '2026-07-01T00:00:00.000Z' }],
        error: null,
      },
    },
  })
}

function renderWithProviders() {
  return render(
    <AppProviders>
      <PaymentDetailsSettings />
    </AppProviders>
  )
}

describe('PaymentDetailsSettings', () => {
  beforeEach(() => {
    Object.assign(supabaseMock, baseConfig())
  })

  it('precarga los datos de cobro guardados del usuario', async () => {
    renderWithProviders()

    const input = (await screen.findByPlaceholderText(/Ej: juan.perez/)) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('juan.perez'))
  })

  it('guarda con upsert sobre user_payment_details al enviar', async () => {
    renderWithProviders()
    const input = await screen.findByPlaceholderText(/Ej: juan.perez/) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'cbu.nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }))

    await waitFor(() => {
      const upsertCall = supabaseMock.from.mock.results
        .map((r) => r.value)
        .find((b) => b.upsert.mock.calls.length > 0)
      expect(upsertCall?.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', payment_details: 'cbu.nuevo' }),
        { onConflict: 'user_id' }
      )
    })

    expect(await screen.findByText(/Guardado/)).toBeTruthy()
  })

  it('muestra error si el upsert falla', async () => {
    supabaseMock.from = vi.fn(() => {
      const builder = makeQueryBuilder({ data: null, error: null })
      builder.upsert = vi.fn(() => ({ data: null, error: { message: 'sin red' } }))
      return builder
    })

    renderWithProviders()
    const input = await screen.findByPlaceholderText(/Ej: juan.perez/) as HTMLInputElement

    fireEvent.change(input, { target: { value: 'mi.cbu' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar datos de cobro/ }))

    expect(await screen.findByText(/Error al guardar los datos de cobro/)).toBeTruthy()
  })
})
