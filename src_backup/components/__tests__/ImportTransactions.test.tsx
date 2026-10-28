import { describe, it, expect } from 'vitest'
import { parseDate, parseAmount } from '../ImportTransactions'

describe('ImportTransactions — parseDate', () => {
  it('parsea formato ISO (yyyy-mm-dd)', () => {
    const d = parseDate('2026-03-15')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(2) // marzo = índice 2
    expect(d?.getDate()).toBe(15)
  })

  it('parsea formato argentino (dd/mm/yyyy)', () => {
    const d = parseDate('15/03/2026')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(2)
    expect(d?.getDate()).toBe(15)
  })

  it('parsea formato argentino con guiones (dd-mm-yyyy)', () => {
    const d = parseDate('05-01-2026')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(0)
    expect(d?.getDate()).toBe(5)
  })

  it('devuelve null si el formato no se reconoce', () => {
    expect(parseDate('no es una fecha')).toBeNull()
  })
})

describe('ImportTransactions — parseAmount', () => {
  it('parsea un monto simple con punto decimal', () => {
    expect(parseAmount('1234.56')).toBeCloseTo(1234.56)
  })

  it('parsea formato argentino: miles con punto, decimales con coma', () => {
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56)
  })

  it('parsea un monto con coma como separador decimal simple', () => {
    expect(parseAmount('1234,56')).toBeCloseTo(1234.56)
  })

  it('preserva el signo negativo', () => {
    expect(parseAmount('-1.234,56')).toBeCloseTo(-1234.56)
  })

  it('ignora símbolos de moneda y espacios', () => {
    expect(parseAmount('$ 1.234,56')).toBeCloseTo(1234.56)
  })

  it('devuelve null si no hay número', () => {
    expect(parseAmount('abc')).toBeNull()
  })
})
