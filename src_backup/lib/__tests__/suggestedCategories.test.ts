import { describe, it, expect } from 'vitest'
import { SUGGESTED_CATEGORIES } from '../suggestedCategories'
import { CATEGORY_ICON_NAMES, getCategoryIcon, CATEGORY_ICONS } from '../categoryIcons'

describe('SUGGESTED_CATEGORIES', () => {
  it('tiene exactamente 15 categorías', () => {
    expect(SUGGESTED_CATEGORIES).toHaveLength(15)
  })

  it('no tiene nombres duplicados', () => {
    const names = SUGGESTED_CATEGORIES.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('todas tienen color e ícono definidos', () => {
    for (const cat of SUGGESTED_CATEGORIES) {
      expect(cat.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(cat.icon).toBeTruthy()
    }
  })

  it('todos los íconos referenciados existen en el catálogo de íconos', () => {
    for (const cat of SUGGESTED_CATEGORIES) {
      expect(CATEGORY_ICON_NAMES).toContain(cat.icon)
    }
  })
})

describe('getCategoryIcon', () => {
  it('devuelve el ícono correspondiente a un nombre válido', () => {
    expect(getCategoryIcon('car')).toBe(CATEGORY_ICONS.car)
  })

  it('devuelve el ícono de fallback (Tag) si el nombre no existe', () => {
    expect(getCategoryIcon('no-existe')).toBe(CATEGORY_ICONS.tag)
  })

  it('devuelve el ícono de fallback si el nombre es null o undefined', () => {
    expect(getCategoryIcon(null)).toBe(CATEGORY_ICONS.tag)
    expect(getCategoryIcon(undefined)).toBe(CATEGORY_ICONS.tag)
  })
})
