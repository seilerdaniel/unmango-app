import { describe, it, expect } from 'vitest'
import { parseTelegramMessage } from './message-parser'

describe('parseTelegramMessage', () => {
  it('reconoce un código de vinculación con /start', () => {
    const result = parseTelegramMessage('/start 483920')
    expect(result).toEqual({ kind: 'link_code', code: '483920' })
  })

  it('reconoce un código de vinculación solo (sin /start)', () => {
    const result = parseTelegramMessage('483920')
    expect(result).toEqual({ kind: 'link_code', code: '483920' })
  })

  it('parsea un gasto simple: "Gasto 4500 café"', () => {
    const result = parseTelegramMessage('Gasto 4500 café')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'café' })
  })

  it('parsea un gasto sin la palabra "Gasto" adelante', () => {
    const result = parseTelegramMessage('4500 café')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'café' })
  })

  it('usa una descripción genérica si no queda texto después del monto', () => {
    const result = parseTelegramMessage('Gasto 4500')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'Gasto por Telegram' })
  })

  it('parsea montos en formato argentino', () => {
    const result = parseTelegramMessage('Gasto 1.500,50 supermercado')
    expect(result.kind).toBe('expense')
    expect((result as { amount: number }).amount).toBeCloseTo(1500.5)
  })

  it('devuelve unrecognized si no hay ningún número ni código', () => {
    const result = parseTelegramMessage('hola como estas')
    expect(result).toEqual({ kind: 'unrecognized' })
  })

  it('devuelve unrecognized para un monto de 0 o negativo', () => {
    expect(parseTelegramMessage('Gasto 0 nada').kind).toBe('unrecognized')
  })
})
