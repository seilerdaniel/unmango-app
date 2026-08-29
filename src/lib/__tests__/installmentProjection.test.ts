import { describe, it, expect } from 'vitest'
import {
  buildUpcomingInstallments,
  projectInstallmentCommitments,
  type PurchaseProjectionInput,
} from '../installmentProjection'

// Un período fijo: agosto 2026 (mes 8, año 2026).
const NOW = new Date(2026, 7, 15)

describe('buildUpcomingInstallments', () => {
  it('arma las cuotas pendientes excluyendo las pagadas y las ordena por mes', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Notebook',
        totalAmount: 60000,
        installmentsCount: 6,
        firstInstallmentDate: '2026-08-01',
        paidNumbers: [1, 2],
      },
    ]
    const upcoming = buildUpcomingInstallments(purchases)
    expect(upcoming).toHaveLength(4)
    expect(upcoming[0]).toMatchObject({
      description: 'Notebook',
      installmentNumber: 3,
      totalInstallments: 6,
      year: 2026,
      month: 10,
    })
  })

  it('el último número de cuota absorbe el redondeo (la suma da el total)', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Tv',
        totalAmount: 10000,
        installmentsCount: 3,
        firstInstallmentDate: '2026-01-01',
        paidNumbers: [],
      },
    ]
    const upcoming = buildUpcomingInstallments(purchases)
    expect(upcoming).toHaveLength(3)
    const sum = upcoming.reduce((acc, u) => acc + u.amount, 0)
    expect(Math.round(sum * 100) / 100).toBe(10000)
  })

  it('descarta compras con primera cuota inválida o sin cuotas', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Invalida',
        totalAmount: 1000,
        installmentsCount: 3,
        firstInstallmentDate: 'no-es-fecha',
        paidNumbers: [],
      },
      {
        description: 'Sin cuotas',
        totalAmount: 1000,
        installmentsCount: 0,
        firstInstallmentDate: '2026-01-01',
        paidNumbers: [],
      },
    ]
    expect(buildUpcomingInstallments(purchases)).toHaveLength(0)
  })
})

describe('projectInstallmentCommitments', () => {
  it('agrupa por mes dentro del horizonte y suma los montos', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Notebook',
        totalAmount: 30000,
        installmentsCount: 3,
        firstInstallmentDate: '2026-08-01',
        paidNumbers: [],
      },
    ]
    const upcoming = buildUpcomingInstallments(purchases)
    const projected = projectInstallmentCommitments(upcoming, 3, NOW)
    // Cuotas 1, 2 y 3 vencen en Ago, Sep y Oct (todas dentro del horizonte de 3 meses).
    expect(projected).toHaveLength(3)
    expect(projected[0].label).toBe('Ago 2026')
    expect(projected[0].amount).toBe(10000)
    expect(projected[0].count).toBe(1)
    expect(projected[1].label).toBe('Sep 2026')
    expect(projected[1].amount).toBe(10000)
    expect(projected[2].label).toBe('Oct 2026')
    expect(projected[2].amount).toBe(10000)
  })

  it('recorta las cuotas que caen fuera del horizonte de meses', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Celular',
        totalAmount: 60000,
        installmentsCount: 12,
        firstInstallmentDate: '2026-08-01',
        paidNumbers: [],
      },
    ]
    const upcoming = buildUpcomingInstallments(purchases)
    const projected = projectInstallmentCommitments(upcoming, 3, NOW)
    // Solo Ago + Sep + Oct (3 meses).
    expect(projected).toHaveLength(3)
    const total = projected.reduce((acc, m) => acc + m.amount, 0)
    expect(total).toBe(15000) // 3 × 5000
  })

  it('excluye cuotas de meses pasados (ya vencidas y no pagadas)', () => {
    const purchases: PurchaseProjectionInput[] = [
      {
        description: 'Moto',
        totalAmount: 30000,
        installmentsCount: 6,
        firstInstallmentDate: '2026-05-01',
        paidNumbers: [1, 2],
      },
    ]
    const upcoming = buildUpcomingInstallments(purchases)
    const projected = projectInstallmentCommitments(upcoming, 3, NOW)
    // Cuotas 3..6 caen en jul, ago, sep, oct. Hoy es 15/ago → julio queda fuera.
    const labels = projected.map((m) => m.label)
    expect(labels).toEqual(['Ago 2026', 'Sep 2026', 'Oct 2026'])
  })
})