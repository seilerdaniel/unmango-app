import { describe, it, expect } from 'vitest'
import { buildExchangeGapSeries, computeGapSummary } from '../exchangeGap'

describe('buildExchangeGapSeries', () => {
  it('convierte el balance en ARS a su equivalente en USD al tipo de cambio de cada día', () => {
    const series = buildExchangeGapSeries([
      { snapshotDate: '2026-01-01', totalBalanceArs: 145000, usdBlueRate: 1450 },
      { snapshotDate: '2026-02-01', totalBalanceArs: 150000, usdBlueRate: 1500 },
    ])
    expect(series[0].balanceUsdEquivalent).toBeCloseTo(100)
    expect(series[1].balanceUsdEquivalent).toBeCloseTo(100)
  })

  it('no rompe si la cotización es 0', () => {
    const series = buildExchangeGapSeries([{ snapshotDate: '2026-01-01', totalBalanceArs: 100000, usdBlueRate: 0 }])
    expect(series[0].balanceUsdEquivalent).toBe(0)
  })
})

describe('computeGapSummary', () => {
  it('devuelve null si hay menos de 2 snapshots (no hay período que comparar)', () => {
    expect(computeGapSummary([])).toBeNull()
    expect(computeGapSummary([{ snapshotDate: '2026-01-01', totalBalanceArs: 100000, usdBlueRate: 1000 }])).toBeNull()
  })

  it('detecta cuando el patrimonio en pesos creció más que el dólar (brecha positiva)', () => {
    // Patrimonio en pesos creció 20%, pero el dólar solo subió 10% -> en
    // USD el patrimonio también creció, brecha positiva.
    const summary = computeGapSummary([
      { snapshotDate: '2026-01-01', totalBalanceArs: 100000, usdBlueRate: 1000 },
      { snapshotDate: '2026-02-01', totalBalanceArs: 120000, usdBlueRate: 1100 },
    ])
    expect(summary?.arsGrowthPercent).toBeCloseTo(20)
    expect(summary?.gapPercent).toBeGreaterThan(0)
  })

  it('detecta cuando el patrimonio le perdió a la devaluación (brecha negativa)', () => {
    // El peso se devaluó 50% pero el patrimonio en pesos solo creció 10%
    // -> en USD el patrimonio se achicó, brecha negativa.
    const summary = computeGapSummary([
      { snapshotDate: '2026-01-01', totalBalanceArs: 100000, usdBlueRate: 1000 },
      { snapshotDate: '2026-02-01', totalBalanceArs: 110000, usdBlueRate: 1500 },
    ])
    expect(summary?.gapPercent).toBeLessThan(0)
  })

  it('no rompe si el balance inicial es 0', () => {
    const summary = computeGapSummary([
      { snapshotDate: '2026-01-01', totalBalanceArs: 0, usdBlueRate: 1000 },
      { snapshotDate: '2026-02-01', totalBalanceArs: 50000, usdBlueRate: 1000 },
    ])
    expect(summary?.arsGrowthPercent).toBe(0)
  })
})
