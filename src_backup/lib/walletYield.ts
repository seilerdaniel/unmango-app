import { round2 } from './money'

/**
 * Rendimiento estimado de una billetera según su TNA (tasa nominal
 * anual, en %). La TNA es la tasa que paga la cuenta remunerada, el
 * FCI o el plazo fijo por año; el rendimiento diario y mensual se
 * prorratea de forma lineal (TNA/365 y TNA/12) como hacen las
 * billeteras virtuales locales para mostrar el "te rinde" de la
 * plata.
 */

export function dailyYield(balance: number, tna: number): number {
  if (balance <= 0 || !(tna > 0)) return 0
  return round2((balance * (tna / 100)) / 365)
}

export function monthlyYield(balance: number, tna: number): number {
  if (balance <= 0 || !(tna > 0)) return 0
  return round2((balance * (tna / 100)) / 12)
}

export interface YieldWallet {
  balance: number
  /** Nullable/optional para admitir `WalletWithBalance`, que usa `tna_percentage`. */
  tnaPercentage?: number | null
}

/** Renta diaria total estimada sumando las billeteras que rinden (TNA > 0). */
export function consolidatedDailyYield(wallets: YieldWallet[]): number {
  return round2(wallets.reduce((acc, w) => acc + dailyYield(w.balance, w.tnaPercentage ?? 0), 0))
}

/** Renta mensual total estimada sumando las billeteras que rinden (TNA > 0). */
export function consolidatedMonthlyYield(wallets: YieldWallet[]): number {
  return round2(wallets.reduce((acc, w) => acc + monthlyYield(w.balance, w.tnaPercentage ?? 0), 0))
}
