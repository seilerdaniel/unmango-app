import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurringManager from '../RecurringManager'
import { CategoriesProvider } from '@/context/CategoriesContext'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { WalletsProvider } from '@/context/WalletsContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'

// El mock tiene que existir antes de que se evalúe vi.mock (que Vitest
// "hoistea" al principio del archivo), por eso se crea con vi.hoisted en
// vez de una variable normal.
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const RECURRING_ITEM_ARS = {
  id: 'rec-1',
  user_id: 'user-1',
  category_id: null,
  title: 'Netflix',
  amount: 5000,
  currency: 'ARS' as const,
  billing_day: 10,
  is_active: true,
  created_at: '2026-07-01T00:00:00.000Z',
  categories: null,
  payment_method: null,
  membership_type: null,
  tax_percentage: 0,
  wallet_id: null,
  expense_kind: 'subscription' as const,
  billing_frequency: 'monthly' as const,
  billing_month: null,
}

const RECURRING_ITEM_USD = {
  ...RECURRING_ITEM_ARS,
  id: 'rec-2',
  title: 'Spotify',
  currency: 'USD' as const,
  amount: 12,
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <CategoriesProvider>
          <WalletsProvider>{ui}</WalletsProvider>
        </CategoriesProvider>
      </PrivacyProvider>
    </AppProviders>
  )
}

describe('RecurringManager — botón Pagar (regresión Fase 0)', () => {
  beforeEach(() => {
    const fresh = createSupabaseMock({
      tableResults: {
        categories: { data: [], error: null },
        recurring_expenses: { data: [RECURRING_ITEM_ARS], error: null },
      },
    })
    Object.assign(supabaseMock, fresh)
  })

  it('inserta la transacción con los campos reales del schema (description, payment_method, is_usd), no title/notes', async () => {
    renderWithProviders(<RecurringManager />)

    const payButton = await screen.findByRole('button', { name: /pagar/i })
    await userEvent.click(payButton)

    await waitFor(() => {
      expect(supabaseMock.from).toHaveBeenCalledWith('transactions')
    })

    // Buscamos la llamada a from('transactions') y revisamos qué se le
    // pasó a .insert(...)
    const transactionsCallIndex = supabaseMock._fromCalls.lastIndexOf('transactions')
    expect(transactionsCallIndex).toBeGreaterThanOrEqual(0)

    const transactionsBuilder = supabaseMock.from.mock.results[transactionsCallIndex].value
    expect(transactionsBuilder.insert).toHaveBeenCalledTimes(1)

    const insertedRows = transactionsBuilder.insert.mock.calls[0][0]
    const insertedRow = insertedRows[0]

    // Campos que el bug original usaba y que no existen en el schema real
    expect(insertedRow).not.toHaveProperty('title')
    expect(insertedRow).not.toHaveProperty('notes')

    // Campos requeridos por el schema real (types/database.ts)
    expect(insertedRow).toHaveProperty('description')
    expect(insertedRow).toHaveProperty('payment_method')
    expect(insertedRow).toHaveProperty('is_usd', false)
    expect(insertedRow.amount_ars).toBe(5000)
  })

  it('para suscripciones en USD, pide la cotización en vez de usar un multiplicador fijo', async () => {
    const fresh = createSupabaseMock({
      tableResults: {
        categories: { data: [], error: null },
        recurring_expenses: { data: [RECURRING_ITEM_USD], error: null },
      },
    })
    Object.assign(supabaseMock, fresh)

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('1300')

    renderWithProviders(<RecurringManager />)

    const payButton = await screen.findByRole('button', { name: /pagar/i })
    await userEvent.click(payButton)

    expect(promptSpy).toHaveBeenCalled()

    await waitFor(() => {
      const transactionsCallIndex = supabaseMock._fromCalls.lastIndexOf('transactions')
      const transactionsBuilder = supabaseMock.from.mock.results[transactionsCallIndex].value
      expect(transactionsBuilder.insert).toHaveBeenCalledTimes(1)
    })

    const transactionsCallIndex = supabaseMock._fromCalls.lastIndexOf('transactions')
    const transactionsBuilder = supabaseMock.from.mock.results[transactionsCallIndex].value
    const insertedRow = transactionsBuilder.insert.mock.calls[0][0][0]

    // 12 USD * cotización 1300 ingresada por el usuario, NO *1000 hardcodeado
    expect(insertedRow.amount_ars).toBe(12 * 1300)
    expect(insertedRow.exchange_rate).toBe(1300)
    expect(insertedRow.is_usd).toBe(true)

    promptSpy.mockRestore()
  })
})

describe('RecurringManager — aviso de vencimiento próximo (Fase 5)', () => {
  it('muestra el banner "Vencen pronto" para una suscripción que factura en los próximos días', async () => {
    // Calculamos un billing_day que caiga dentro de los próximos 3 días
    // desde "hoy" (según la fecha real de ejecución del test), para no
    // depender de una fecha fija hardcodeada.
    const today = new Date()
    const soonDate = new Date(today)
    soonDate.setDate(today.getDate() + 3)
    const billingDaySoon = soonDate.getDate()

    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          recurring_expenses: {
            data: [{ ...RECURRING_ITEM_ARS, title: 'Netflix', billing_day: billingDaySoon }],
            error: null,
          },
        },
      })
    )

    renderWithProviders(<RecurringManager />)

    expect(await screen.findByText(/Vencen pronto/i)).toBeInTheDocument()
  })

  it('NO muestra el banner para una suscripción que factura en más de 7 días', async () => {
    const today = new Date()
    const farDate = new Date(today)
    farDate.setDate(today.getDate() + 20)
    const billingDayFar = farDate.getDate()

    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          recurring_expenses: {
            data: [{ ...RECURRING_ITEM_ARS, title: 'Netflix', billing_day: billingDayFar }],
            error: null,
          },
        },
      })
    )

    renderWithProviders(<RecurringManager />)

    await screen.findByText('Netflix')
    expect(screen.queryByText(/Vencen pronto/i)).not.toBeInTheDocument()
  })
})

describe('RecurringManager — editar suscripción existente', () => {
  it('el botón Editar precarga el formulario con los datos de la suscripción', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          recurring_expenses: { data: [RECURRING_ITEM_ARS], error: null },
        },
      })
    )

    renderWithProviders(<RecurringManager />)

    const editButton = await screen.findByTitle('Editar')
    await userEvent.click(editButton)

    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    expect(screen.getByText(/Editando "Netflix"/i)).toBeInTheDocument()
  })

  it('guardar los cambios llama a update() en vez de insert()', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          recurring_expenses: { data: [RECURRING_ITEM_ARS], error: null },
        },
      })
    )

    renderWithProviders(<RecurringManager />)

    const editButton = await screen.findByTitle('Editar')
    await userEvent.click(editButton)

    const submitButton = screen.getByRole('button', { name: /guardar cambios/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      const builders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'recurring_expenses')
        .map((r) => r.value)
      const updatedBuilder = builders.find((b) => b.update.mock.calls.length > 0)
      expect(updatedBuilder).toBeDefined()
      expect(updatedBuilder!.insert).not.toHaveBeenCalled()
    })
  })

  it('cancelar la edición vuelve al formulario vacío para crear una nueva', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          categories: { data: [], error: null },
          recurring_expenses: { data: [RECURRING_ITEM_ARS], error: null },
        },
      })
    )

    renderWithProviders(<RecurringManager />)

    const editButton = await screen.findByTitle('Editar')
    await userEvent.click(editButton)
    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByText(/Editando/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^agregar$/i })).toBeInTheDocument()
  })
})
