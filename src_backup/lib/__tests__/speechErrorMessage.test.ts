import { describe, it, expect } from 'vitest'
import { speechErrorMessage } from '../speechErrorMessage'

describe('speechErrorMessage', () => {
  it('explica el permiso denegado y qué hacer', () => {
    expect(speechErrorMessage('not-allowed')).toContain('permisos')
  })

  it('explica que no se detectó voz', () => {
    expect(speechErrorMessage('no-speech')).toContain('voz')
  })

  it('explica que hace falta conexión', () => {
    expect(speechErrorMessage('network')).toContain('internet')
  })

  it('no muestra nada si el usuario lo canceló a propósito', () => {
    expect(speechErrorMessage('aborted')).toBe('')
  })

  it('tiene un mensaje genérico para códigos desconocidos', () => {
    expect(speechErrorMessage('algo-raro-inventado')).not.toBe('')
  })
})
