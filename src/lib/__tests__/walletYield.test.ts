import { describe, it, expect } from 'vitest'
import { dailyYield, monthlyYield, consolidatedDailyYield, consolidatedMonthlyYield } from '../walletYield'

describe('walletYield', () => {
  it('dailyYield prorratea la TNA a 365 días', () => {
    expect(dailyYield(100000, 36.5)).toBe(100)
    expect(dailyYield(150000, 38)).toBe(156.16)
  })

  it('monthlyYield prorratea la TNA a 12 meses', () => {
    expect(monthlyYield(100000, 12)).toBe(1000)
  })

  it('devuelve 0 con saldo cero o TNA 0', () => {
    expect(dailyYield(0, 40)).toBe(0)
    expect(dailyYield(50000, 0)).toBe(0)
    expect(monthlyYield(0, 40)).toBe(0)
    expect(monthlyYield(50000, -5)).toBe(0)
  })

  it('consolidatedDailyYield suma solo las billeteras que rinden', () => {
    const wallets = [
      { balance: 100000, tnaPercentage: 36.5 },
      { balance: 50000, tnaPercentage: null },
      { balance: 30000, tnaPercentage: 0 },
      { balance: 120000, tnaPercentage: 36.5 },
    ]
    expect(consolidatedDailyYield(wallets)).toBe(220)
  })

  it('consolidatedMonthlyYield suma solo las billeteras que rinden', () => {
    const wallets = [
      { balance: 120000, tnaPercentage: 12 },
      { balance: 50000, tnaPercentage: null },
    ]
    expect(consolidatedMonthlyYield(wallets)).toBe(1200)
  })

  it('consolidated con array vacío da 0', () => {
    expect(consolidatedDailyYield([])).toBe(0)
    expect(consolidatedMonthlyYield([])).toBe(0)
  })
})
