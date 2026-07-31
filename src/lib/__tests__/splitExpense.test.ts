import { describe, it, expect } from 'vitest'
import { computeSplitShare, buildSplitExpenseMessage, buildWhatsAppLink } from '../splitExpense'

describe('computeSplitShare', () => {
  it('divide el monto en partes iguales', () => {
    expect(computeSplitShare(3000, 3)).toBe(1000)
  })

  it('redondea a 2 decimales', () => {
    expect(computeSplitShare(1000, 3)).toBe(333.33)
  })

  it('devuelve 0 si la cantidad de personas es 0 o negativa', () => {
    expect(computeSplitShare(1000, 0)).toBe(0)
    expect(computeSplitShare(1000, -2)).toBe(0)
  })
})

describe('buildSplitExpenseMessage', () => {
  it('arma el mensaje con la descripción y el monto', () => {
    const msg = buildSplitExpenseMessage('Cena del viernes', '$ 5.000')
    expect(msg).toContain('Cena del viernes')
    expect(msg).toContain('$ 5.000')
  })

  it('incluye el alias si se pasa uno', () => {
    const msg = buildSplitExpenseMessage('Cena', '$ 5.000', 'juan.perez')
    expect(msg).toContain('Alias: juan.perez')
  })

  it('no incluye la línea de alias si no se pasa ninguno', () => {
    const msg = buildSplitExpenseMessage('Cena', '$ 5.000')
    expect(msg).not.toContain('Alias:')
  })
})

describe('buildWhatsAppLink', () => {
  it('arma el link genérico (sin contacto) cuando no hay teléfono', () => {
    const link = buildWhatsAppLink('hola')
    expect(link).toBe('https://wa.me/?text=hola')
  })

  it('arma el link con el teléfono cuando se pasa uno, sacando caracteres no numéricos', () => {
    const link = buildWhatsAppLink('hola', '+54 9 11-1234-5678')
    expect(link).toBe('https://wa.me/5491112345678?text=hola')
  })

  it('codifica correctamente el mensaje para la URL', () => {
    const link = buildWhatsAppLink('Hola! Te toca $1.000')
    expect(link).toContain(encodeURIComponent('Hola! Te toca $1.000'))
  })
})
