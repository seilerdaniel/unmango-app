import { describe, it, expect } from 'vitest'
import { SUGGESTED_GOALS } from '../suggestedGoals'

describe('SUGGESTED_GOALS', () => {
  it('tiene 3 metas de ejemplo', () => {
    expect(SUGGESTED_GOALS).toHaveLength(3)
  })

  it('no tiene nombres duplicados', () => {
    const names = SUGGESTED_GOALS.map((g) => g.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('todas tienen montos positivos y color válido', () => {
    for (const goal of SUGGESTED_GOALS) {
      expect(goal.targetAmount).toBeGreaterThan(0)
      expect(goal.monthlyContribution).toBeGreaterThan(0)
      expect(goal.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('el aporte mensual es siempre menor al objetivo (tiene sentido como meta)', () => {
    for (const goal of SUGGESTED_GOALS) {
      expect(goal.monthlyContribution).toBeLessThan(goal.targetAmount)
    }
  })
})
