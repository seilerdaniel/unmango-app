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

export type TelegramCommand =
  | 'saldo'
  | 'gastado'
  | 'safetospend'
  | 'ayuda'
  | 'start'
  | 'score'
  | 'deudas'
  | 'cuotas'
  | 'metas'
  | 'fijos'
  | 'consejos'
  | 'hogar'
  | 'billeteras'
  | 'vencimientos'

export type ParsedTelegramMessage =
  | { kind: 'link_code'; code: string }
  | { kind: 'expense'; amount: number; description: string }
  | { kind: 'debt'; debtType: 'debo' | 'me_deben'; amount: number; counterpartyName: string }
  | { kind: 'debt_payment'; amount: number; personName: string; paymentType: 'pay' | 'collect' }
  | { kind: 'recurring_payment'; amount: number; serviceName: string }
  | { kind: 'installment'; description: string; totalAmount: number; installmentsCount: number }
  | { kind: 'recurring'; description: string; amount: number; expenseKind: 'subscription' | 'utility_rent' }
  | { kind: 'savings_goal'; name: string; targetAmount: number }
  | { kind: 'command'; command: TelegramCommand }
  | { kind: 'unknown_command'; command: string }
  | { kind: 'unrecognized' }

const LINK_CODE_PATTERN = /^\/start\s+(\d{6})$|^(\d{6})$/

const KNOWN_COMMANDS: Record<string, TelegramCommand> = {
  saldo: 'saldo',
  gastado: 'gastado',
  safetospend: 'safetospend',
  ayuda: 'ayuda',
  help: 'ayuda',
  start: 'start',
  score: 'score',
  deudas: 'deudas',
  cuotas: 'cuotas',
  metas: 'metas',
  fijos: 'fijos',
  consejos: 'consejos',
  hogar: 'hogar',
  billeteras: 'billeteras',
  vencimientos: 'vencimientos',
}

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
function extractDescription(text: string, amount: number | null, fallback = 'Gasto por Telegram'): string {
  let cleaned = text
  if (amount !== null) {
    cleaned = cleaned.replace(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/, '')
  }
  cleaned = cleaned.replace(/^\s*(gasto|gasté|pagué|compré)\s*/i, '').trim()
  return cleaned || fallback
}

function stripAmount(text: string): string {
  return text.replace(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/, '').trim()
}

function cleanName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "Debo 5000 a Juan" (le debo plata a alguien) o "Me debe 3000 Pedro"
 * (alguien me debe plata a mí).
 */
function parseDebt(text: string): ParsedTelegramMessage | null {
  const deboMatch = text.match(/^(?:le\s+)?debo\s+(.+?)\s+a\s+(.+)$/i)
  if (deboMatch) {
    const amount = extractAmount(deboMatch[1])
    if (amount === null || amount <= 0) return null
    return { kind: 'debt', debtType: 'debo', amount, counterpartyName: cleanName(deboMatch[2]) }
  }

  const meDebeMatch = text.match(/^me\s+debe\s+(.+)$/i)
  if (meDebeMatch) {
    const amount = extractAmount(meDebeMatch[1])
    if (amount === null || amount <= 0) return null
    const name = cleanName(stripAmount(meDebeMatch[1]))
    return { kind: 'debt', debtType: 'me_deben', amount, counterpartyName: name || 'la otra persona' }
  }

  return null
}

function cleanPersonName(raw: string): string {
  return cleanName(raw).replace(/^(?:a|de)\s+/i, '')
}

/**
 * "Pagué 5000 a Juan", "Cobré 5000 de Juan", "Pago deuda Silvana 45000"
 * o "Pago 45000 Silvana" — registra un pago (o cobro) sobre una deuda
 * existente. El monto y el nombre de la persona se extraen según el
 * formato; el tipo de pago (pay/collect) sale del verbo.
 */
function parseDebtPayment(text: string): ParsedTelegramMessage | null {
  const payToMatch = text.match(/^pagu[eé]\s+(.+?)\s+a\s+(.+)$/i)
  if (payToMatch) {
    const amount = extractAmount(payToMatch[1])
    if (amount === null || amount <= 0) return null
    return { kind: 'debt_payment', amount, personName: cleanName(payToMatch[2]), paymentType: 'pay' }
  }

  const collectMatch = text.match(/^cobr[eé]\s+(.+?)\s+de\s+(.+)$/i)
  if (collectMatch) {
    const amount = extractAmount(collectMatch[1])
    if (amount === null || amount <= 0) return null
    return { kind: 'debt_payment', amount, personName: cleanName(collectMatch[2]), paymentType: 'collect' }
  }

  const deudaMatch = text.match(/^pago\s+deuda\s+(.+)$/i)
  if (deudaMatch) {
    const amount = extractAmount(deudaMatch[1])
    if (amount === null || amount <= 0) return null
    const personName = cleanPersonName(stripAmount(deudaMatch[1]))
    if (!personName) return null
    return { kind: 'debt_payment', amount, personName, paymentType: 'pay' }
  }

  const pagoMatch = text.match(/^pago\s+(?!servicio|deuda)(.+)$/i)
  if (pagoMatch) {
    const amount = extractAmount(pagoMatch[1])
    if (amount === null || amount <= 0) return null
    const personName = cleanPersonName(stripAmount(pagoMatch[1]))
    if (!personName) return null
    return { kind: 'debt_payment', amount, personName, paymentType: 'pay' }
  }

  return null
}

function cleanServiceName(raw: string): string {
  return cleanName(raw).replace(/^(?:el|la|los|las)\s+/i, '')
}

/**
 * "Pago servicio Netflix 5000", "Pagué Netflix 5000" o "Pagué alquiler
 * 20000" — registra el pago de un servicio/suscripción existente. El
 * nombre del servicio va ANTES del monto ("Pagué Netflix 5000") para no
 * confundirse con un gasto común, donde el monto va primero ("Pagué
 * 4500 café").
 */
function parseRecurringPayment(text: string): ParsedTelegramMessage | null {
  const servicioMatch = text.match(/^pago\s+servicio\s+(.+)$/i)
  if (servicioMatch) {
    const amount = extractAmount(servicioMatch[1])
    if (amount === null || amount <= 0) return null
    const serviceName = cleanServiceName(stripAmount(servicioMatch[1]))
    if (!serviceName) return null
    return { kind: 'recurring_payment', amount, serviceName }
  }

  const pagueMatch = text.match(/^pagu[eé]\s+(?!\d)(.+)$/i)
  if (pagueMatch) {
    const amount = extractAmount(pagueMatch[1])
    if (amount === null || amount <= 0) return null
    const serviceName = cleanServiceName(stripAmount(pagueMatch[1]))
    if (!serviceName) return null
    return { kind: 'recurring_payment', amount, serviceName }
  }

  return null
}

const INSTALLMENT_EN_PATTERN = /^(.+?)\s+en\s+(\d{1,2})\s+cuotas?$/i
const INSTALLMENT_VERB_PATTERN =
  /^(?:compré|compre|comprar|compra)\s+(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+(\d{1,2})\s+cuotas?$/i

/**
 * "Heladera 200000 en 12 cuotas" o "Compra 200000 12 cuotas".
 */
function parseInstallment(text: string): ParsedTelegramMessage | null {
  const enMatch = text.match(INSTALLMENT_EN_PATTERN)
  if (enMatch) {
    const amount = extractAmount(enMatch[1])
    const count = Number(enMatch[2])
    if (amount === null || amount <= 0 || count <= 0) return null
    const description = extractDescription(enMatch[1], amount, 'Compra en cuotas')
    return { kind: 'installment', description, totalAmount: amount, installmentsCount: count }
  }

  const verbMatch = text.match(INSTALLMENT_VERB_PATTERN)
  if (verbMatch) {
    const amount = extractAmount(verbMatch[1])
    const count = Number(verbMatch[2])
    if (amount === null || amount <= 0 || count <= 0) return null
    return { kind: 'installment', description: 'Compra en cuotas', totalAmount: amount, installmentsCount: count }
  }

  return null
}

/**
 * Palabras que disparan un gasto fijo/suscripción. Se evalúan al inicio
 * del mensaje (o como keyword "mensual" en cualquier parte) para no
 * confundir con un gasto común tipo "Gasto 4500 café".
 */
const RECURRING_PREFIX = /^(?:suscripci|subscription|alquiler|servicio|expensas|fijo)/i

/**
 * "Suscripción 5000 Netflix", "Alquiler 20000", "Servicio 3000 luz",
 * "Cable 3000 mensual" o "Fijo 2000 cable".
 */
function parseRecurring(text: string): ParsedTelegramMessage | null {
  let expenseKind: 'subscription' | 'utility_rent' | null = null

  // Si el usuario escribió explícitamente un verbo de gasto común
  // ("Gasto 20000 alquiler", "Pagüé 20000 luz"), es un gasto, no un
  // gasto fijo — el keyword del medio no tiene que ganarle.
  if (/^(gasto|gasté|pagué|compré|comprar|compra)\b/i.test(text)) return null

  if (RECURRING_PREFIX.test(text)) {
    expenseKind = /^(?:suscripci|subscription)/i.test(text) ? 'subscription' : 'utility_rent'
  } else if (/(suscripci|subscription|mensual)/i.test(text)) {
    expenseKind = 'subscription'
  } else if (/(alquiler|servicio|expensas|fijo)/i.test(text)) {
    expenseKind = 'utility_rent'
  }

  if (expenseKind === null) return null

  const amount = extractAmount(text)
  if (amount === null || amount <= 0) return null

  const description = stripAmount(text)
    .replace(/^(?:suscripci[oó]n|subscription|alquiler|servicio|expensas|fijo|mensual)\s*/i, '')
    .replace(/\s+(?:suscripci[oó]n|subscription|alquiler|servicio|expensas|mensual)\s*$/i, '')
    .trim()

  return {
    kind: 'recurring',
    description: cleanName(description) || 'Gasto fijo por Telegram',
    amount,
    expenseKind,
  }
}

const META_PATTERN = /^meta\s+(.+)$/i
const AHORRAR_PATTERN = /^ahorrar\s+(.+?)\s+para\s+(.+)$/i

/**
 * "Meta Vacaciones 200000", "Meta 200000 para Vacaciones" o
 * "Ahorrar 50000 para viaje".
 */
function parseSavingsGoal(text: string): ParsedTelegramMessage | null {
  const ahorrarMatch = text.match(AHORRAR_PATTERN)
  if (ahorrarMatch) {
    const amount = extractAmount(ahorrarMatch[1])
    if (amount === null || amount <= 0) return null
    return { kind: 'savings_goal', name: cleanName(ahorrarMatch[2]) || 'Mi meta', targetAmount: amount }
  }

  const metaMatch = text.match(META_PATTERN)
  if (metaMatch) {
    const rest = metaMatch[1]
    const paraMatch = rest.match(/^(.*?)\s+para\s+(.+)$/i)
    const amount = extractAmount(paraMatch ? paraMatch[1] : rest)
    if (amount === null || amount <= 0) return null
    const name = paraMatch ? cleanName(paraMatch[2]) : cleanName(stripAmount(rest))
    return { kind: 'savings_goal', name: name || 'Mi meta', targetAmount: amount }
  }

  return null
}

/**
 * Interpreta un mensaje entrante del bot: puede ser un comando
 * (/saldo, /gastado, /safetospend, /score, /deudas, /cuotas, /metas,
 * /fijos, /consejos, /hogar, /billeteras, /vencimientos, /ayuda), un
 * código de vinculación (6 dígitos, con o sin "/start" adelante) o una
 * intención en texto libre: gasto ("Gasto 4500 café"), deuda
 * ("Debo 5000 a Juan"), pago de deuda ("Pagué 5000 a Juan", "Cobré
 * 3000 de Pedro"), pago de servicio ("Pago servicio Netflix 5000",
 * "Pagué Netflix 5000"), cuotas ("Heladera 200000 en 12 cuotas"), gasto
 * fijo/suscripción ("Suscripción 5000 Netflix") o meta de ahorro
 * ("Meta Vacaciones 200000").
 */
export function parseTelegramMessage(text: string): ParsedTelegramMessage {
  const trimmed = text.trim()

  if (trimmed.startsWith('/')) {
    const linkMatch = trimmed.match(/^\/start\s+(\d{6})$/)
    if (linkMatch) {
      return { kind: 'link_code', code: linkMatch[1] }
    }

    const commandMatch = trimmed.match(/^\/([a-z_]+)/i)
    if (commandMatch) {
      const known = KNOWN_COMMANDS[commandMatch[1].toLowerCase()]
      if (known) {
        return { kind: 'command', command: known }
      }
      return { kind: 'unknown_command', command: commandMatch[1].toLowerCase() }
    }
  }

  const linkMatch = trimmed.match(LINK_CODE_PATTERN)
  if (linkMatch) {
    return { kind: 'link_code', code: linkMatch[1] ?? linkMatch[2] }
  }

  // Las intenciones en texto libre se evalúan ANTES del gasto genérico:
  // deuda ("Debo... a..." / "Me debe..."), pagos de deudas ("Pagué X a
  // Y", "Cobré X de Y", "Pago deuda...", "Pago X Y"), pagos de
  // servicios ("Pago servicio...", "Pagué <servicio> <monto>"), cuotas
  // ("... en N cuotas"), fijos/suscripciones ("Suscripción...",
  // "Alquiler...", "... mensual") y metas ("Meta...", "Ahorrar...
  // para...").
  const debt = parseDebt(trimmed)
  if (debt) return debt

  const debtPayment = parseDebtPayment(trimmed)
  if (debtPayment) return debtPayment

  const recurringPayment = parseRecurringPayment(trimmed)
  if (recurringPayment) return recurringPayment

  const installment = parseInstallment(trimmed)
  if (installment) return installment

  const recurring = parseRecurring(trimmed)
  if (recurring) return recurring

  const savingsGoal = parseSavingsGoal(trimmed)
  if (savingsGoal) return savingsGoal

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
