import { describe, it, expect } from 'vitest'
import { computeRule502030 } from '../rule502030'

describe('computeRule502030', () => {
  it('calcula los targets como 50/30/20 del ingreso', () => {
    const result = computeRule502030(100000, [], {})
    expect(result.necesidad.target).toBe(50000)
    expect(result.deseo.target).toBe(30000)
    expect(result.ahorro.target).toBe(20000)
  })

  it('suma el gasto de cada categoría al grupo que le corresponde', () => {
    const result = computeRule502030(
      100000,
      [
        { categoryId: 'alquiler', spent: 40000 },
        { categoryId: 'super', spent: 10000 },
        { categoryId: 'salidas', spent: 15000 },
      ],
      { alquiler: 'necesidad', super: 'necesidad', salidas: 'deseo' }
    )
    expect(result.necesidad.spent).toBe(50000)
    expect(result.deseo.spent).toBe(15000)
    expect(result.ahorro.spent).toBe(0)
  })

  it('acumula el gasto de categorías sin clasificar aparte, sin perderlo', () => {
    const result = computeRule502030(
      100000,
      [{ categoryId: 'sin-clasificar', spent: 5000 }],
      {}
    )
    expect(result.unclassifiedSpend).toBe(5000)
    expect(result.necesidad.spent).toBe(0)
  })

  it('calcula el porcentaje del ingreso gastado en cada grupo', () => {
    const result = computeRule502030(
      100000,
      [{ categoryId: 'alquiler', spent: 60000 }],
      { alquiler: 'necesidad' }
    )
    expect(result.necesidad.percentOfIncome).toBeCloseTo(60)
  })

  it('no rompe si el ingreso del mes es 0 (evita división por cero)', () => {
    const result = computeRule502030(0, [{ categoryId: 'x', spent: 100 }], { x: 'necesidad' })
    expect(result.necesidad.percentOfIncome).toBe(0)
    expect(result.necesidad.target).toBe(0)
  })
})
