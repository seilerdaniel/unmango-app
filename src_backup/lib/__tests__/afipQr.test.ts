import { describe, it, expect } from 'vitest'
import { parseAfipQrUrl } from '../afipQr'

function buildAfipUrl(data: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(data))
  return `https://www.afip.gob.ar/fe/qr/?p=${encoded}`
}

describe('parseAfipQrUrl', () => {
  it('decodifica correctamente una URL de factura AFIP válida', () => {
    const url = buildAfipUrl({
      ver: 1,
      fecha: '2026-07-28',
      cuit: 20111111112,
      ptoVta: 5,
      tipoCmp: 6,
      nroCmp: 123,
      importe: 15000.5,
      moneda: 'PES',
      ctz: 1,
    })

    const result = parseAfipQrUrl(url)
    expect(result).not.toBeNull()
    expect(result?.importe).toBe(15000.5)
    expect(result?.cuit).toBe(20111111112)
    expect(result?.fecha).toBe('2026-07-28')
  })

  it('devuelve null si la URL no tiene el parámetro p', () => {
    expect(parseAfipQrUrl('https://www.afip.gob.ar/fe/qr/')).toBeNull()
  })

  it('devuelve null si el contenido no es una URL válida', () => {
    expect(parseAfipQrUrl('esto no es una url')).toBeNull()
  })

  it('devuelve null si el base64 no decodifica a JSON válido', () => {
    expect(parseAfipQrUrl('https://www.afip.gob.ar/fe/qr/?p=no-es-base64-valido!!!')).toBeNull()
  })

  it('devuelve null si falta el campo importe (no es un QR de factura)', () => {
    const url = buildAfipUrl({ cuit: 20111111112, fecha: '2026-07-28' })
    expect(parseAfipQrUrl(url)).toBeNull()
  })
})
