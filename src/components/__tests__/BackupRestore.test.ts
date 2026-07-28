import { describe, it, expect } from 'vitest'
import { remapForeignKey } from '../BackupRestore'

describe('remapForeignKey', () => {
  it('traduce un id viejo al nuevo id según el mapa', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey('old-1', map)).toBe('new-1')
  })

  it('devuelve null si el id no está en el mapa (no rompe el insert)', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey('old-2', map)).toBeNull()
  })

  it('devuelve null si el id original es null', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey(null, map)).toBeNull()
  })

  it('devuelve null si el id original no es un string (ej. undefined)', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey(undefined, map)).toBeNull()
  })
})
