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
})
