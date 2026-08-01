import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VoiceExpenseInput from '../VoiceExpenseInput'
import { CategoriesProvider } from '@/context/CategoriesContext'
import { WalletsProvider } from '@/context/WalletsContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'

import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const SUPERMERCADO_CATEGORY = { id: 'cat-1', user_id: 'user-1', name: 'Supermercado', color: '#10b981', icon: null, created_at: '' }

function renderWithProviders(onTransactionAdded = vi.fn()) {
  return render(
    <CategoriesProvider>
      <WalletsProvider>
        <VoiceExpenseInput isOpen={true} onClose={() => {}} onTransactionAdded={onTransactionAdded} />
      </WalletsProvider>
    </CategoriesProvider>
  )
}

describe('VoiceExpenseInput', () => {
  it('usa el medio de pago detectado en el texto (antes quedaba hardcodeado en Efectivo)', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [SUPERMERCADO_CATEGORY], error: null },
          wallets: { data: [], error: null },
        },
      })
    )

    renderWithProviders()

    const textInput = screen.getByPlaceholderText('Ej: Gasté 8500 en Coto con tarjeta')
    await userEvent.type(textInput, 'Gasté 8500 en Coto con tarjeta de credito')

    // El select de medio de pago tiene que reflejar "Tarjeta de Crédito", no "Efectivo".
    const paymentSelect = screen.getAllByRole('combobox').find((el) => (el as HTMLSelectElement).value === 'Tarjeta de Crédito')
    expect(paymentSelect).toBeDefined()
  })

  it('adivina la categoría por palabra clave si el usuario ya la tiene creada', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [SUPERMERCADO_CATEGORY], error: null },
          wallets: { data: [], error: null },
        },
      })
    )

    renderWithProviders()

    const textInput = screen.getByPlaceholderText('Ej: Gasté 8500 en Coto con tarjeta')
    await userEvent.type(textInput, 'Gasté 8500 en Coto')

    const categorySelect = screen.getAllByRole('combobox').find((el) => (el as HTMLSelectElement).value === 'cat-1')
    expect(categorySelect).toBeDefined()
  })

  it('extrae el monto y la descripción del texto', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          wallets: { data: [], error: null },
        },
      })
    )

    renderWithProviders()

    const textInput = screen.getByPlaceholderText('Ej: Gasté 8500 en Coto con tarjeta')
    await userEvent.type(textInput, 'Gasté 8500 en Coto con tarjeta')

    expect(screen.getByPlaceholderText('Monto')).toHaveValue(8500)
    expect(screen.getByPlaceholderText('Descripción')).toHaveValue('Coto')
  })
})
