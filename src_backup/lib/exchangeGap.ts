export interface NetWorthSnapshot {
  snapshotDate: string
  totalBalanceArs: number
  usdBlueRate: number
}

export interface ExchangeGapPoint {
  date: string
  balanceArs: number
  balanceUsdEquivalent: number
}

export interface ExchangeGapSummary {
  arsGrowthPercent: number
  /**
   * Crecimiento de tu patrimonio medido en dólares Blue (no en pesos).
   * Es el indicador de "le gané o le perdí a la devaluación": positivo
   * significa que tu patrimonio en pesos creció MÁS que lo que se
   * devaluó la moneda en el período (tenés más poder de compra real que
   * antes); negativo significa que, aunque en pesos hayas crecido, en
   * términos reales perdiste valor.
   */
  usdGrowthPercent: number
  /** Alias de usdGrowthPercent — es la "brecha" en sí (mismo valor, nombre más descriptivo del concepto de la idea original). */
  gapPercent: number
}

/**
 * Convierte los snapshots crudos en la serie que se grafica: el balance
 * en pesos tal cual, y su equivalente en USD Blue al tipo de cambio de
 * ESE día (no el de hoy — así se ve la evolución real).
 */
export function buildExchangeGapSeries(snapshots: NetWorthSnapshot[]): ExchangeGapPoint[] {
  return snapshots.map((s) => ({
    date: s.snapshotDate,
    balanceArs: s.totalBalanceArs,
    balanceUsdEquivalent: s.usdBlueRate > 0 ? s.totalBalanceArs / s.usdBlueRate : 0,
  }))
}

/**
 * Compara cuánto creció tu patrimonio en pesos contra cuánto creció su
 * equivalente en dólares Blue, entre el primer y el último snapshot.
 * Devuelve null si hay menos de 2 puntos (no hay período que comparar
 * todavía).
 */
export function computeGapSummary(snapshots: NetWorthSnapshot[]): ExchangeGapSummary | null {
  if (snapshots.length < 2) return null

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]

  const arsGrowthPercent =
    first.totalBalanceArs !== 0 ? ((last.totalBalanceArs - first.totalBalanceArs) / Math.abs(first.totalBalanceArs)) * 100 : 0

  const firstUsdEquivalent = first.usdBlueRate > 0 ? first.totalBalanceArs / first.usdBlueRate : 0
  const lastUsdEquivalent = last.usdBlueRate > 0 ? last.totalBalanceArs / last.usdBlueRate : 0
  const usdGrowthPercent =
    firstUsdEquivalent !== 0 ? ((lastUsdEquivalent - firstUsdEquivalent) / Math.abs(firstUsdEquivalent)) * 100 : 0

  return {
    arsGrowthPercent,
    usdGrowthPercent,
    gapPercent: usdGrowthPercent,
  }
}
