import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import HouseholdExpenses from '../HouseholdExpenses'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock, makeQueryBuilder } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const ACTIVE_LINK = {
  id: 'household-1',
  user_a_id: 'user-1',
  user_b_id: 'user-2',
  invite_code: 'ABC',
  status: 'active' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  linked_at: '2026-07-02T00:00:00.000Z',
}

const EXPENSES = [
  {
    id: 'exp-1',
    household_id: 'household-1',
    paid_by_user_id: 'user-1',
    description: 'Alquiler',
    amount: 60000,
    created_at: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'exp-2',
    household_id: 'household-1',
    paid_by_user_id: 'user-2',
    description: 'Super',
    amount: 40000,
    created_at: '2026-07-02T00:00:00.000Z',
  },
]

function baseConfig() {
  return createSupabaseMock({
    user: { id: 'user-1', email: 'me@b.com' },
    tableResults: {
      household_links: { data: [ACTIVE_LINK], error: null },
      household_expenses: { data: EXPENSES, error: null },
      user_payment_details: {
        data: [{ user_id: 'user-1', payment_details: 'juan.perez', updated_at: '2026-07-01T00:00:00.000Z' }],
        error: null,
      },
    },
    rpcResults: {
      get_household_partner_email: { data: 'pareja@b.com', error: null },
    },
  })
}

function renderWithProviders() {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <HouseholdExpenses />
      </PrivacyProvider>
    </AppProviders>
  )
}

describe('HouseholdExpenses', () => {
  beforeEach(() => {
    Object.assign(supabaseMock, baseConfig())
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('muestra el balance cuando la pareja me debe plata (pagué más de la mitad)', async () => {
    renderWithProviders()

    await waitFor(() => expect(screen.getByText(/te debe/)).toBeTruthy())
    expect(screen.getByText(/10\.000/)).toBeTruthy()
  })

  it('listar gastos va contra household_expenses filtrado por el hogar', async () => {
    renderWithProviders()

    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())
    expect(screen.getByText('Super')).toBeTruthy()

    const selectCalls = supabaseMock.from.mock.calls.filter(([table]) => table === 'household_expenses')
    expect(selectCalls.length).toBeGreaterThan(0)
  })

  it('agregar un gasto inserta con el pagador = usuario actual y recarga la lista', async () => {
    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText(/¿Qué gasto es\?/), { target: { value: 'Expensas' } })
    fireEvent.change(screen.getByPlaceholderText('Monto'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }))

    await waitFor(() => {
      const insertCall = supabaseMock.from.mock.results
        .map((r) => r.value)
        .find((b) => b.insert.mock.calls.length > 0)
      expect(insertCall?.insert).toHaveBeenCalledWith([
        {
          household_id: 'household-1',
          paid_by_user_id: 'user-1',
          description: 'Expensas',
          amount: 15000,
        },
      ])
    })
  })

  it('borrar un gasto hace delete().eq(id) sobre household_expenses', async () => {
    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    const deleteButtons = screen.getAllByRole('button')
    const trashButton = deleteButtons.find((b) => b.querySelector('svg') && b.textContent === '')!
    fireEvent.click(trashButton)

    await waitFor(() => {
      const deleteCall = supabaseMock.from.mock.results
        .map((r) => r.value)
        .find((b) => b.delete.mock.calls.length > 0)
      expect(deleteCall).toBeTruthy()
      expect(deleteCall.eq).toHaveBeenCalledWith('id', 'exp-1')
    })
  })

  it('"Marcar como saldado" muestra el monto exacto a transferir antes de confirmar', async () => {
    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como saldado' }))

    // user-1 pagó 60.000 y user-2 40.000: la pareja transfiere 10.000.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/te transfiere/)).toBeTruthy()
    expect(within(dialog).getByText(/10\.000/)).toBeTruthy()
  })

  it('confirmar la liquidación borra todos los gastos del hogar', async () => {
    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como saldado' }))
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByRole('button', { name: 'Saldar' }))

    await waitFor(() => {
      const deleteCall = supabaseMock.from.mock.results
        .map((r) => r.value)
        .find((b) => b.delete.mock.calls.length > 0)
      expect(deleteCall).toBeTruthy()
      expect(deleteCall.eq).toHaveBeenCalledWith('household_id', 'household-1')
    })
  })

  it('si el insert falla, muestra error y conserva lo escrito en el formulario', async () => {
    const tableResults: Record<string, { data: unknown; error: unknown }> = {
      household_links: { data: [ACTIVE_LINK], error: null },
      household_expenses: { data: EXPENSES, error: null },
    }
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        user: { id: 'user-1', email: 'me@b.com' },
        tableResults,
        rpcResults: { get_household_partner_email: { data: 'pareja@b.com', error: null } },
      })
    )
    // El select inicial funciona, pero el insert de este builder falla.
    supabaseMock.from = vi.fn((table: string) => {
      const builder = makeQueryBuilder(tableResults[table] ?? { data: [], error: null })
      builder.insert = vi.fn(() => ({ data: null, error: { message: 'sin red' } }))
      return builder
    })

    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    const descriptionInput = screen.getByPlaceholderText(/¿Qué gasto es\?/)
    fireEvent.change(descriptionInput, { target: { value: 'Expensas' } })
    fireEvent.change(screen.getByPlaceholderText('Monto'), { target: { value: '15000' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar/ }))

    expect(await screen.findByText(/Error al registrar el gasto/)).toBeTruthy()
    expect((screen.getByPlaceholderText(/¿Qué gasto es\?/) as HTMLInputElement).value).toBe('Expensas')
    expect((screen.getByPlaceholderText('Monto') as HTMLInputElement).value).toBe('15000')
  })

  it('"Cobrar por WhatsApp" copia la tarjeta (con datos de cobro) y abre wa.me cuando me deben', async () => {
    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Cobrar por WhatsApp' }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    const copied = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(copied).toContain('"Gastos de hogar"')
    expect(copied).toContain('Datos para transferir: juan.perez')

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text='), '_blank')
  })

  it('no muestra "Cobrar por WhatsApp" si yo le debo a la pareja', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        user: { id: 'user-1', email: 'me@b.com' },
        tableResults: {
          household_links: { data: [ACTIVE_LINK], error: null },
          household_expenses: {
            data: [
              { ...EXPENSES[0], paid_by_user_id: 'user-2' },
              { ...EXPENSES[1], paid_by_user_id: 'user-1' },
            ],
            error: null,
          },
        },
        rpcResults: { get_household_partner_email: { data: 'pareja@b.com', error: null } },
      })
    )

    renderWithProviders()
    await waitFor(() => expect(screen.getByText('Alquiler')).toBeTruthy())

    expect(screen.queryByRole('button', { name: 'Cobrar por WhatsApp' })).toBeNull()
  })
})
