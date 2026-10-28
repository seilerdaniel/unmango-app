import { describe, it, expect } from 'vitest'
import { guessCategoryName } from '../expenseCategoryGuess'

describe('guessCategoryName', () => {
  it('reconoce un supermercado conocido', () => {
    expect(guessCategoryName('Gasté 8500 en Coto con tarjeta')).toBe('Supermercado')
  })

  it('reconoce transporte (nafta)', () => {
    expect(guessCategoryName('Cargué nafta en la YPF')).toBe('Transporte')
  })

  it('reconoce delivery', () => {
    expect(guessCategoryName('Pedí por PedidosYa')).toBe('Restaurantes y Delivery')
  })

  it('no distingue mayúsculas/minúsculas', () => {
    expect(guessCategoryName('COTO SUPERMERCADO')).toBe('Supermercado')
  })

  it('devuelve null si no reconoce nada', () => {
    expect(guessCategoryName('Le pagué a Juan por el arreglo')).toBeNull()
  })

  it('devuelve null con texto vacío, sin romper', () => {
    expect(guessCategoryName('')).toBeNull()
  })
})
