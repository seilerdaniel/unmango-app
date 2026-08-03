import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WalletManager from '../WalletManager'
import { PrivacyProvider } from '@/context/PrivacyContext'
import { WalletsProvider } from '@/context/WalletsContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

const WALLET_ROW = {
  id: 'wallet-1',
  user_id: 'user-1',
  name: 'Mercado Pago',
  type: 'virtual_wallet' as const,
  color: '#6366f1',
  initial_balance: 1000,
  created_at: '2026-07-01T00:00:00.000Z',
}

function renderWithProviders() {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <WalletsProvider>
          <WalletManager />
        </WalletsProvider>
      </PrivacyProvider>
    </AppProviders>
  )
}

function renderWithProvidersAndPricing({ onOpenPricing }: { onOpenPricing: () => void }) {
  return render(
    <AppProviders>
      <PrivacyProvider>
        <WalletsProvider>
          <WalletManager onOpenPricing={onOpenPricing} />
        </WalletsProvider>
      </PrivacyProvider>
    </AppProviders>
  )
}

describe('WalletManager', () => {
  it('muestra el saldo calculado por get_wallet_balances(), no el saldo inicial solo', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [WALLET_ROW], error: null } },
        rpcResults: {
          get_wallet_balances: { data: [{ wallet_id: 'wallet-1', balance: 4500 }], error: null },
        },
      })
    )

    renderWithProviders()

    await screen.findByText('Mercado Pago')
    expect(screen.getAllByText('$ 4.500').length).toBeGreaterThan(0)
  })

  it('crea una billetera con los campos correctos', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [], error: null } },
        rpcResults: { get_wallet_balances: { data: [], error: null } },
      })
    )

    renderWithProviders()

    await screen.findByText(/Todavía no creaste ninguna billetera/i)

    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'Ualá')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    // Ojo: from('wallets') se llama varias veces (carga inicial, el
    // insert, y el reload posterior) — hay que ubicar el builder que
    // efectivamente recibió el insert, no el último de la lista (que
    // termina siendo el del reload).
    await waitFor(() => {
      const walletBuilders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
        .map((r) => r.value)
      const insertedBuilder = walletBuilders.find((b) => b.insert.mock.calls.length > 0)
      expect(insertedBuilder).toBeDefined()
    })

    const walletBuilders = supabaseMock.from.mock.results
      .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
      .map((r) => r.value)
    const insertedBuilder = walletBuilders.find((b) => b.insert.mock.calls.length > 0)!
    const insertedRow = insertedBuilder.insert.mock.calls[0][0][0]

    expect(insertedRow.name).toBe('Ualá')
    expect(insertedRow.user_id).toBe('user-1')
    expect(insertedRow).toHaveProperty('type')
    expect(insertedRow).toHaveProperty('initial_balance')
  })

  it('guarda tna_percentage cuando se carga una TNA', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [], error: null } },
        rpcResults: { get_wallet_balances: { data: [], error: null } },
      })
    )

    renderWithProviders()

    await screen.findByText(/Todavía no creaste ninguna billetera/i)

    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'Ualá')
    await userEvent.type(screen.getByPlaceholderText('TNA % (opcional)'), '38')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    await waitFor(() => {
      const walletBuilders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
        .map((r) => r.value)
      expect(walletBuilders.find((b) => b.insert.mock.calls.length > 0)).toBeDefined()
    })

    const walletBuilders = supabaseMock.from.mock.results
      .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
      .map((r) => r.value)
    const insertedBuilder = walletBuilders.find((b) => b.insert.mock.calls.length > 0)!
    const insertedRow = insertedBuilder.insert.mock.calls[0][0][0]

    expect(insertedRow.tna_percentage).toBe(38)
  })

  it('guarda currency USD cuando se elige dólares', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [], error: null } },
        rpcResults: { get_wallet_balances: { data: [], error: null } },
      })
    )

    renderWithProviders()

    await screen.findByText(/Todavía no creaste ninguna billetera/i)

    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'Caja de ahorro USD')
    await userEvent.selectOptions(screen.getAllByRole('combobox')[1], 'USD')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    await waitFor(() => {
      const walletBuilders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
        .map((r) => r.value)
      expect(walletBuilders.find((b) => b.insert.mock.calls.length > 0)).toBeDefined()
    })

    const walletBuilders = supabaseMock.from.mock.results
      .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
      .map((r) => r.value)
    const insertedBuilder = walletBuilders.find((b) => b.insert.mock.calls.length > 0)!
    const insertedRow = insertedBuilder.insert.mock.calls[0][0][0]

    expect(insertedRow.currency).toBe('USD')
  })

  it('muestra la etiqueta USD en la lista y la precarga al editar', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          wallets: { data: [{ ...WALLET_ROW, name: 'Caja de ahorro USD', currency: 'USD' }], error: null },
        },
        rpcResults: {
          get_wallet_balances: { data: [{ wallet_id: 'wallet-1', balance: 1450000 }], error: null },
        },
      })
    )

    renderWithProviders()

    await screen.findByText('Caja de ahorro USD')
    expect(screen.getByText(/🇺🇸 USD/)).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('Editar billetera'))
    const currencySelect = screen.getAllByRole('combobox')[1]
    expect(currencySelect).toHaveValue('USD')
  })

  it('el botón Editar precarga la TNA y la guarda con update()', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          wallets: { data: [{ ...WALLET_ROW, tna_percentage: 38 }], error: null },
        },
        rpcResults: {
          get_wallet_balances: { data: [{ wallet_id: 'wallet-1', balance: 4500 }], error: null },
        },
      })
    )

    renderWithProviders()

    const editButton = await screen.findByTitle('Editar billetera')
    await userEvent.click(editButton)

    expect(screen.getByDisplayValue('38')).toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: /guardar cambios/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      const walletBuilders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
        .map((r) => r.value)
      const updatedBuilder = walletBuilders.find((b) => b.update.mock.calls.length > 0)
      expect(updatedBuilder).toBeDefined()
      expect(updatedBuilder!.update.mock.calls[0][0]).toMatchObject({ tna_percentage: 38 })
    })
  })

  it('el botón Editar precarga el formulario y guarda con update() en vez de insert()', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [WALLET_ROW], error: null } },
        rpcResults: {
          get_wallet_balances: { data: [{ wallet_id: 'wallet-1', balance: 4500 }], error: null },
        },
      })
    )

    renderWithProviders()

    const editButton = await screen.findByTitle('Editar billetera')
    await userEvent.click(editButton)

    expect(screen.getByDisplayValue('Mercado Pago')).toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: /guardar cambios/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      const walletBuilders = supabaseMock.from.mock.results
        .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
        .map((r) => r.value)
      const updatedBuilder = walletBuilders.find((b) => b.update.mock.calls.length > 0)
      expect(updatedBuilder).toBeDefined()
      expect(updatedBuilder!.insert).not.toHaveBeenCalled()
    })
  })

  it('muestra el banner de plan FREE con el contador de billeteras', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [WALLET_ROW], error: null } },
        rpcResults: {
          get_wallet_balances: { data: [{ wallet_id: 'wallet-1', balance: 4500 }], error: null },
        },
      })
    )

    renderWithProviders()

    expect(await screen.findByText(/Plan FREE: 1\/2 billeteras usadas/i)).toBeInTheDocument()
  })

  it('muestra el badge [ ⭐ PRO ] en el campo TNA para el plan FREE', async () => {
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: { wallets: { data: [], error: null } },
        rpcResults: { get_wallet_balances: { data: [], error: null } },
      })
    )

    renderWithProviders()

    await screen.findByText(/Todavía no creaste ninguna billetera/i)
    const badge = screen.getByTitle('La TNA es una función PRO')
    expect(badge).toHaveTextContent('PRO')
  })

  it('bloquea la creación en plan FREE al llegar al límite de 2 billeteras y abre el pricing', async () => {
    const onOpenPricing = vi.fn()
    Object.assign(
      supabaseMock,
      createSupabaseMock({
        tableResults: {
          wallets: {
            data: [WALLET_ROW, { ...WALLET_ROW, id: 'wallet-2', name: 'Ualá' }],
            error: null,
          },
        },
        rpcResults: {
          get_wallet_balances: {
            data: [
              { wallet_id: 'wallet-1', balance: 1000 },
              { wallet_id: 'wallet-2', balance: 2000 },
            ],
            error: null,
          },
        },
      })
    )

    renderWithProvidersAndPricing({ onOpenPricing })

    expect(await screen.findByText(/Plan FREE: 2\/2 billeteras usadas/i)).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'Banco')
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }))

    expect(onOpenPricing).toHaveBeenCalled()
    const walletBuilders = supabaseMock.from.mock.results
      .filter((_, idx) => supabaseMock._fromCalls[idx] === 'wallets')
      .map((r) => r.value)
    expect(walletBuilders.some((b) => b.insert.mock.calls.length > 0)).toBe(false)
  })
})
