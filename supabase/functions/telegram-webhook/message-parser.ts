// Lógica pura, sin nada de Deno ni de Telegram, para poder testear con
// Vitest igual que el resto del proyecto. index.ts (la Edge Function en
// sí) importa esto.
//
// Nota de duplicación: la parte de "parsear un gasto en lenguaje
// natural" es conceptualmente la misma que
// src/lib/naturalLanguageExpense.ts del frontend, pero está reescrita
// acá porque esta función corre en Deno, un runtime completamente
// aparte del build de Next.js — no se puede importar directamente el
// archivo del frontend. Si cambiás la lógica de parseo en un lado,
// replicá el cambio en el otro.

export type ParsedTelegramMessage =
  | { kind: 'link_code'; code: string }
  | { kind: 'expense'; amount: number; description: string }
  | { kind: 'unrecognized' }

const LINK_CODE_PATTERN = /^\/start\s+(\d{6})$|^(\d{6})$/

function extractAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) return null

  let raw = match[1]
  if (raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = raw.split('.')
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      raw = parts.join('')
    }
  }

  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

/**
 * Descripción = lo que queda del mensaje después de sacar el monto,
 * limpio de espacios. Es más simple que el parser del frontend (no
 * busca "en X con Y") porque en Telegram el patrón esperado es más
 * directo: "Gasto 4500 café" o simplemente "4500 café".
 */
function extractDescription(text: string, amount: number | null): string {
  let cleaned = text
  if (amount !== null) {
    cleaned = cleaned.replace(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/, '')
  }
  cleaned = cleaned.replace(/^\s*(gasto|gasté|pagué|compré)\s*/i, '').trim()
  return cleaned || 'Gasto por Telegram'
}

/**
 * Interpreta un mensaje entrante del bot: puede ser un código de
 * vinculación (6 dígitos, con o sin "/start" adelante) o un gasto en
 * texto libre tipo "Gasto 4500 café".
 */
export function parseTelegramMessage(text: string): ParsedTelegramMessage {
  const trimmed = text.trim()

  const linkMatch = trimmed.match(LINK_CODE_PATTERN)
  if (linkMatch) {
    return { kind: 'link_code', code: linkMatch[1] ?? linkMatch[2] }
  }

  const amount = extractAmount(trimmed)
  if (amount === null || amount <= 0) {
    return { kind: 'unrecognized' }
  }

  return {
    kind: 'expense',
    amount,
    description: extractDescription(trimmed, amount),
  }
}
