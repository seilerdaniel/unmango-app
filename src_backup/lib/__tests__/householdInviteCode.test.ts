import { describe, it, expect } from 'vitest'
import { generateHouseholdInviteCode } from '../householdInviteCode'

describe('generateHouseholdInviteCode', () => {
  it('genera un código de 8 caracteres', () => {
    expect(generateHouseholdInviteCode()).toHaveLength(8)
  })

  it('no usa caracteres ambiguos (0, O, 1, I)', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateHouseholdInviteCode()
      expect(code).not.toMatch(/[0O1I]/)
    }
  })

  it('solo usa mayúsculas y dígitos', () => {
    const code = generateHouseholdInviteCode()
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })
})
