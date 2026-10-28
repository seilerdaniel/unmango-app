/**
 * % de diferencia entre una cotización y la oficial (ej. "el Blue está
 * X% más caro que el Oficial"). Devuelve null si no hay cotización
 * oficial para comparar (no se puede calcular una brecha sin base).
 */
export function computeRateGapPercent(officialRate: number | null, otherRate: number | null): number | null {
  if (officialRate === null || otherRate === null || officialRate === 0) return null
  return ((otherRate - officialRate) / officialRate) * 100
}
