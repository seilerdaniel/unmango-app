import { describe, it, expect } from 'vitest'
import { parseNaturalLanguageExpense } from '../naturalLanguageExpense'

describe('parseNaturalLanguageExpense', () => {
  it('parsea el ejemplo de la idea original: "Gasté 8500 en coto con tarjeta"', () => {
    const result = parseNaturalLanguageExpense('Gasté 8500 en coto con tarjeta')
    expect(result.amount).toBe(8500)
    expect(result.description).toBe('Coto')
    expect(result.type).toBe('expense')
    expect(result.paymentMethodHint).toBe('Tarjeta de Crédito')
  })

  it('detecta un ingreso por el verbo usado', () => {
    const result = parseNaturalLanguageExpense('Cobré 50000 de sueldo')
    expect(result.type).toBe('income')
  })

  it('por defecto asume gasto si no hay verbo de ingreso', () => {
    const result = parseNaturalLanguageExpense('1200 en el kiosco')
    expect(result.type).toBe('expense')
  })

  it('parsea montos en formato argentino con miles y decimales', () => {
    const result = parseNaturalLanguageExpense('Gasté 1.500,50 en supermercado')
    expect(result.amount).toBeCloseTo(1500.5)
  })

  it('detecta efectivo como medio de pago', () => {
    const result = parseNaturalLanguageExpense('Pagué 300 en el kiosco en efectivo')
    expect(result.paymentMethodHint).toBe('Efectivo')
  })

  it('detecta billetera virtual (Mercado Pago) como medio de pago', () => {
    const result = parseNaturalLanguageExpense('Gasté 2000 en Farmacity con mercadopago')
    expect(result.paymentMethodHint).toBe('Billetera Virtual')
  })

  it('devuelve null en los campos que no puede reconocer, sin romper', () => {
    const result = parseNaturalLanguageExpense('esto no tiene ningún número')
    expect(result.amount).toBeNull()
    expect(result.description).toBeNull()
    expect(result.paymentMethodHint).toBeNull()
  })

  it('devuelve la descripción con la primera letra en mayúscula', () => {
    const result = parseNaturalLanguageExpense('Gasté 500 en farmacia')
    expect(result.description).toBe('Farmacia')
  })
})
