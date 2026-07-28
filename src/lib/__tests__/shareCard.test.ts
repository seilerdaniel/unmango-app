import { describe, it, expect } from 'vitest'
import { buildShareCardLines } from '../shareCard'

const stats = { balance: 50000, totalIncome: 100000, totalExpense: 50000, monthLabel: 'Julio 2026' }
const formatAmount = (n: number) => `$ ${n.toLocaleString('es-AR')}`

describe('buildShareCardLines', () => {
  it('censura los montos por defecto (revealAmounts=false)', () => {
    const lines = buildShareCardLines(stats, false, formatAmount)
    const balance = lines.find((l) => l.label === 'Balance')
    expect(balance?.value).toBe('••••••')
  })

  it('muestra los montos reales cuando revealAmounts=true', () => {
    const lines = buildShareCardLines(stats, true, formatAmount)
    const balance = lines.find((l) => l.label === 'Balance')
    expect(balance?.value).toBe('$ 50.000')
  })

  it('el período nunca se censura (no es información sensible)', () => {
    const lines = buildShareCardLines(stats, false, formatAmount)
    const periodo = lines.find((l) => l.label === 'Período')
    expect(periodo?.value).toBe('Julio 2026')
  })
})
