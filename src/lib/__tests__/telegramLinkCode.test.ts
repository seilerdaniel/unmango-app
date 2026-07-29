import { describe, it, expect } from 'vitest'
import { generateLinkingCode } from '../telegramLinkCode'

describe('generateLinkingCode', () => {
  it('siempre devuelve exactamente 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLinkingCode()
      expect(code).toMatch(/^\d{6}$/)
    }
  })

  it('rellena con ceros a la izquierda cuando el número es chico', () => {
    // No podemos forzar Math.random() de forma limpia sin mockear, pero
    // podemos verificar que el formato siempre tiene longitud 6 en
    // muchas corridas (probabilísticamente cubre números chicos).
    const codes = Array.from({ length: 200 }, () => generateLinkingCode())
    expect(codes.every((c) => c.length === 6)).toBe(true)
  })
})
