import { describe, it, expect } from 'vitest'
import { suggestBudgets } from '../suggestedBudgets'

const CATEGORIES = [
  { id: '1', name: 'Supermercado' },
  { id: '2', name: 'Transporte' },
  { id: '3', name: 'Entretenimiento' },
  { id: '4', name: 'Viajes' },
]

describe('suggestBudgets', () => {
  it('devuelve vacío si no hay ingreso registrado', () => {
    expect(suggestBudgets(0, CATEGORIES)).toEqual([])
  })

  it('devuelve vacío si no hay categorías sin presupuesto', () => {
    expect(suggestBudgets(100000, [])).toEqual([])
  })

  it('sugiere como máximo 3 categorías, aunque haya más disponibles', () => {
    const result = suggestBudgets(100000, CATEGORIES)
    expect(result).toHaveLength(3)
  })

  it('calcula el monto sugerido como % del ingreso mensual', () => {
    const result = suggestBudgets(100000, CATEGORIES)
    expect(result[0].suggestedAmount).toBe(15000) // 15%
    expect(result[1].suggestedAmount).toBe(10000) // 10%
    expect(result[2].suggestedAmount).toBe(8000) // 8%
  })

  it('conserva el nombre y el id de la categoría original', () => {
    const result = suggestBudgets(100000, CATEGORIES)
    expect(result[0].categoryName).toBe('Supermercado')
    expect(result[0].categoryId).toBe('1')
  })
})
