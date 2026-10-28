export interface ParsedExpense {
  amount: number | null
  description: string | null
  type: 'income' | 'expense'
  paymentMethodHint: string | null
}

const INCOME_VERBS = ['cobré', 'cobre', 'recibí', 'recibi', 'ingresé', 'ingrese', 'me pagaron', 'me depositaron']

const PAYMENT_METHOD_PATTERNS: { pattern: RegExp; method: string }[] = [
  { pattern: /tarjeta de cr[eé]dito|con cr[eé]dito/i, method: 'Tarjeta de Crédito' },
  { pattern: /tarjeta de d[eé]bito|con d[eé]bito/i, method: 'Tarjeta de Débito' },
  { pattern: /\btarjeta\b/i, method: 'Tarjeta de Crédito' },
  { pattern: /efectivo/i, method: 'Efectivo' },
  { pattern: /transferencia/i, method: 'Transferencia' },
  { pattern: /mercado ?pago|billetera|uala|ualá|personal ?pay|lemon/i, method: 'Billetera Virtual' },
]

/**
 * Extrae el primer número del texto, tolerando formato argentino
 * (1.500,50) y formato simple (1500, 1500.50). Función interna, no
 * exportada porque el parseo de números para esto es más simple que el
 * de ImportTransactions (acá no hace falta distinguir miles de
 * decimales con la misma sofisticación).
 */
function extractAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) return null

  let raw = match[1]
  // Si tiene coma Y punto, o solo coma, tratamos la coma como decimal
  // (formato argentino). Si solo tiene puntos como separador de miles
  // (ej. "8.500"), lo sacamos.
  if (raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else {
    // Si el punto está seguido de exactamente 3 dígitos y no es la única
    // parte (ej. "8.500"), es separador de miles, no decimal.
    const parts = raw.split('.')
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      raw = parts.join('')
    }
  }

  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

/**
 * Extrae la descripción/lugar entre "en" y el próximo conector
 * ("con", "por", fin de frase). Ej: "Gasté 8500 en Coto con tarjeta" ->
 * "Coto".
 */
function extractDescription(text: string): string | null {
  const match = text.match(/\ben\s+([a-záéíóúñ0-9\s]+?)(?:\s+con\b|\s+por\b|$)/i)
  if (!match) return null
  const description = match[1].trim()
  if (!description) return null
  // Capitaliza la primera letra para que quede prolijo en el campo.
  return description.charAt(0).toUpperCase() + description.slice(1)
}

function detectPaymentMethod(text: string): string | null {
  for (const { pattern, method } of PAYMENT_METHOD_PATTERNS) {
    if (pattern.test(text)) return method
  }
  return null
}

function detectType(text: string): 'income' | 'expense' {
  const lower = text.toLowerCase()
  return INCOME_VERBS.some((verb) => lower.includes(verb)) ? 'income' : 'expense'
}

/**
 * Parsea una frase en lenguaje natural tipo "Gasté 8500 en Coto con
 * tarjeta" y extrae monto, descripción, tipo (ingreso/gasto), y una
 * pista de medio de pago. No pretende ser NLU real — es un conjunto de
 * reglas con regex para los patrones más comunes en español; si no
 * reconoce algo, devuelve null en ese campo y el usuario lo completa a
 * mano en la confirmación antes de guardar (nunca se guarda sin que la
 * persona vea y confirme lo que se entendió).
 */
export function parseNaturalLanguageExpense(text: string): ParsedExpense {
  return {
    amount: extractAmount(text),
    description: extractDescription(text),
    type: detectType(text),
    paymentMethodHint: detectPaymentMethod(text),
  }
}
