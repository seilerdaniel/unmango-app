export interface AfipInvoiceData {
  fecha: string
  cuit: number
  importe: number
  moneda: string
  tipoCmp: number
}

/**
 * Las facturas electrónicas de AFIP traen un QR que codifica una URL
 * del tipo:
 *   https://www.afip.gob.ar/fe/qr/?p=<base64 de un JSON>
 * ese JSON tiene, entre otros campos, "importe" (el total de la
 * factura) — así que se puede leer el monto exacto sin necesitar OCR
 * (que es mucho menos confiable). Ver especificación de AFIP:
 * https://www.afip.gob.ar/fe/qr/especificaciones.asp
 *
 * Devuelve null si la URL no tiene el formato esperado o el JSON no se
 * puede decodificar (ej. es un QR de otra cosa, no de una factura AFIP).
 */
export function parseAfipQrUrl(url: string): AfipInvoiceData | null {
  try {
    const parsed = new URL(url)
    const p = parsed.searchParams.get('p')
    if (!p) return null

    const decoded = atob(p)
    const data = JSON.parse(decoded)

    if (typeof data.importe !== 'number' || typeof data.cuit !== 'number') return null

    return {
      fecha: typeof data.fecha === 'string' ? data.fecha : '',
      cuit: data.cuit,
      importe: data.importe,
      moneda: typeof data.moneda === 'string' ? data.moneda : 'PES',
      tipoCmp: typeof data.tipoCmp === 'number' ? data.tipoCmp : 0,
    }
  } catch {
    return null
  }
}
