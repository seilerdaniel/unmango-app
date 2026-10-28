import { describe, it, expect } from 'vitest'
import { sortWallets, filterWalletsByType } from '../walletSort'
import { WalletWithBalance } from '@/types'

function makeWallet(overrides: Partial<WalletWithBalance>): WalletWithBalance {
  return {
    id: '1',
    user_id: 'u1',
    name: 'Test',
    type: 'cash',
    color: null,
    initial_balance: 0,
    card_network: null,
    created_at: '',
    balance: 0,
    ...overrides,
  } as WalletWithBalance
}

const WALLETS = [
  makeWallet({ id: '1', name: 'Brubank', type: 'virtual_wallet', balance: 25229 }),
  makeWallet({ id: '2', name: 'Credicoop', type: 'bank', balance: 0 }),
  makeWallet({ id: '3', name: 'Mercado Pago', type: 'virtual_wallet', balance: 1473 }),
]

describe('sortWallets', () => {
  it('ordena por nombre A-Z', () => {
    const result = sortWallets(WALLETS, 'name', true)
    expect(result.map((w) => w.name)).toEqual(['Brubank', 'Credicoop', 'Mercado Pago'])
  })

  it('ordena por nombre Z-A', () => {
    const result = sortWallets(WALLETS, 'name', false)
    expect(result.map((w) => w.name)).toEqual(['Mercado Pago', 'Credicoop', 'Brubank'])
  })

  it('ordena por saldo de mayor a menor', () => {
    const result = sortWallets(WALLETS, 'balance', false)
    expect(result.map((w) => w.balance)).toEqual([25229, 1473, 0])
  })

  it('ordena por saldo de menor a mayor', () => {
    const result = sortWallets(WALLETS, 'balance', true)
    expect(result.map((w) => w.balance)).toEqual([0, 1473, 25229])
  })

  it('no muta el array original', () => {
    const original = [...WALLETS]
    sortWallets(WALLETS, 'name', true)
    expect(WALLETS).toEqual(original)
  })
})

describe('filterWalletsByType', () => {
  it('filtra por un tipo específico', () => {
    const result = filterWalletsByType(WALLETS, 'virtual_wallet')
    expect(result).toHaveLength(2)
    expect(result.every((w) => w.type === 'virtual_wallet')).toBe(true)
  })

  it('devuelve todas con "all"', () => {
    expect(filterWalletsByType(WALLETS, 'all')).toHaveLength(3)
  })
})
