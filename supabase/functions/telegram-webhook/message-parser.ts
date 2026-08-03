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
  | 'plan'
  | 'pro'
  | 'billeteras'
  | 'vencimientos'
  | 'resumen'
  | 'gastos'

export interface ParsedDebt {
  kind: 'debt'
  debtType: 'debo' | 'me_deben'
  amount: number
  counterpartyName: string
  notes: string | null
}

export interface ParsedInstallment {
  kind: 'installment'
  description: string
  totalAmount: number
  installmentsCount: number
  installmentAmount: number
  notes: string | null
}

export type ParsedTelegramMessage =
  | { kind: 'link_code'; code: string }
  | {
      kind: 'expense'
      amount: number
      description: string
      type: 'income' | 'expense'
      wallet: string | null
      categoryHint: string | null
      notes: string | null
    }
  | ParsedDebt
  | { kind: 'debt_payment'; amount: number; personName: string; paymentType: 'pay' | 'collect' }
  | { kind: 'recurring_payment'; amount: number; serviceName: string }
  | { kind: 'installment_payment'; amount: number | null; purchaseName: string; installmentNumber: number | null }
  | ParsedInstallment
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
  plan: 'plan',
  pro: 'pro',
  billeteras: 'billeteras',
  vencimientos: 'vencimientos',
  resumen: 'resumen',
  gastos: 'gastos',
}

/**
 * Botones del teclado principal persistente (buildMainReplyKeyboard):
 * el texto que envía cada botón se mapea al comando equivalente para que
 * el handler ejecute lo mismo que si se tipeara /billeteras, etc.
 */
const REPLY_BUTTON_COMMANDS: Array<{ label: string; command: TelegramCommand }> = [
  { label: '💳 billeteras', command: 'billeteras' },
  { label: '📅 vencimientos', command: 'vencimientos' },
  { label: '🎯 safe-to-spend', command: 'safetospend' },
  { label: '📊 mi score', command: 'score' },
]

export type CallbackAction =
  | { kind: 'pay_debt'; debtId: string }
  | { kind: 'pay_installment'; purchaseId: string; installmentNumber: number | null }

/**
 * Interpreta el callback_data de un botón inline. Formatos soportados:
 *   "pay_debt:[id]" — paga la deuda completa.
 *   "pay_installment:[id]" — paga la próxima cuota impaga de la compra.
 *   "pay_installment:[id]:[número]" — paga esa cuota puntual.
 */
export function parseCallbackData(data: string): CallbackAction | null {
  const [action, first, second] = data.split(':')
  const firstPart = first?.trim()
  if (!action || !firstPart) return null

  if (action === 'pay_debt') {
    return { kind: 'pay_debt', debtId: firstPart }
  }

  if (action === 'pay_installment') {
    const rawNumber = second?.trim()
    const installmentNumber = rawNumber ? Number(rawNumber) : null
    return {
      kind: 'pay_installment',
      purchaseId: firstPart,
      installmentNumber:
        installmentNumber !== null && Number.isInteger(installmentNumber) && installmentNumber > 0
          ? installmentNumber
          : null,
    }
  }

  return null
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
  cleaned = cleaned
    .replace(/^\s*(?:gasto|gasté|pagué|compré|cargué|cargue|ingreso|ingresé|ingresó|cobré|cobre|recibí|recibi|me depositaron|me pagaron|me transfirieron|me acreditaron)\s*/i, '')
    .trim()
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
 * Quita los acentos y pasa a minúsculas para comparar keywords
 * tolerantes a tildes (ej. "cobré" y "cobré" con/sin tilde).
 */
function normalizeAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Palabras clave que convierten un mensaje con monto en un INGRESO en vez
 * de un gasto. Se evalúan sobre el texto normalizado (sin tildes, en
 * minúsculas) para tolerar "cobré"/"cobré" y variantes. Mismo espíritu que
 * INCOME_VERBS del frontend (naturalLanguageExpense.ts), ampliado.
 */
const INCOME_PATTERNS: RegExp[] = [
  /^\s*(?:cobre|cobro)\b/, // cobré/cobre, cobro
  /^\s*recibi\b/, // recibí/recibi
  /^\s*(?:ingrese|ingreso)\b/, // ingresé/ingrese/ingreso/ingresó
  /^\s*me\s+(?:pagaron|depositaron|transfirieron|acreditaron)\b/,
  /\b(?:deposito|transferencia recibida|sueldo|haber|honorarios|reembolso)\b/,
]

function detectExpenseType(text: string): 'income' | 'expense' {
  const normalized = normalizeAccents(text)
  return INCOME_PATTERNS.some((pattern) => pattern.test(normalized)) ? 'income' : 'expense'
}

/** "en Mercado Pago", "con Ualá", "por Galicia" — billetera al final. */
const WALLET_PREPOSITION_PATTERN = /\s(?:en|con|por|desde)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][A-Za-zÁÉÍÓÚáéíóúñÑ0-9\s'&-]+)\s*$/i

/** Proveedores conocidos de billetera mencionados sin preposición. */
const WALLET_PROVIDER_PATTERN =
  /\b(?:mercado\s*pago|uala|lemon\s*cash|naranja\s*x|galicia|santander|brubank|prex|bbva|macro|banco\s*naci[oó]n|bna|efectivo|personal\s*pay|cuenta\s*dni|modo)\b/i

/**
 * Pista de billetera: el texto tras "en/con/por/desde" al final, o un
 * proveedor conocido mencionado en cualquier lado. La descripción NO se
 * recorta acá (el handler la conserva); esto solo da la pista para que
 * index.ts la matchee contra las billeteras reales del usuario.
 */
function extractWalletHint(text: string): string | null {
  const prepositionMatch = text.match(WALLET_PREPOSITION_PATTERN)
  if (prepositionMatch) {
    const name = cleanName(prepositionMatch[1])
    if (name) return name
  }
  const providerMatch = text.match(WALLET_PROVIDER_PATTERN)
  if (providerMatch) return cleanName(providerMatch[0])
  return null
}

/** Keywords que mapean a la categoría "Transporte" (ej. SUBE). */
const TRANSPORT_PATTERN = /\b(?:sube|transporte|bondi|colectivo|subte)\b/i

function detectCategoryHint(text: string): string | null {
  return TRANSPORT_PATTERN.test(normalizeAccents(text)) ? 'Transporte' : null
}

/**
 * Extrae una nota libre: un sufijo "nota: ..." / "notas: ..." o un texto
 * entre paréntesis al final ("Debo 5000 a Juan nota: para el viaje" o
 * "Pagué cuota Heladera (adelanté el mes)"). Devuelve la nota y el texto
 * sin ella para que el resto del parseo siga igual.
 */
function extractNotes(text: string): { notes: string | null; rest: string } {
  const notaMatch = text.match(/\s*notas?\s*:\s*(.+)$/i)
  if (notaMatch) {
    const notes = cleanName(notaMatch[1])
    const rest = text.slice(0, notaMatch.index).trim()
    return { notes: notes || null, rest }
  }
  const parenMatch = text.match(/\s*\(([^()]+)\)\s*$/)
  if (parenMatch) {
    const notes = cleanName(parenMatch[1])
    const rest = text.slice(0, parenMatch.index).trim()
    return { notes: notes || null, rest }
  }
  return { notes: null, rest: text }
}

/**
 * "Debo 5000 a Juan" (le debo plata a alguien) o "Me debe 3000 Pedro"
 * (alguien me debe plata a mí).
 */
function parseDebt(text: string): ParsedDebt | null {
  const deboMatch = text.match(/^(?:le\s+)?debo\s+(.+?)\s+a\s+(.+)$/i)
  if (deboMatch) {
    const amount = extractAmount(deboMatch[1])
    if (amount === null || amount <= 0) return null
    return { kind: 'debt', debtType: 'debo', amount, counterpartyName: cleanName(deboMatch[2]), notes: null }
  }

  const meDebeMatch = text.match(/^me\s+debe\s+(.+)$/i)
  if (meDebeMatch) {
    const amount = extractAmount(meDebeMatch[1])
    if (amount === null || amount <= 0) return null
    const name = cleanName(stripAmount(meDebeMatch[1]))
    return { kind: 'debt', debtType: 'me_deben', amount, counterpartyName: name || 'la otra persona', notes: null }
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

  const collectMatch = text.match(/^cobr(?:[eé]|o)\s+(.+?)\s+de\s+(.+)$/i)
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
const INSTALLMENT_NO_EN_PATTERN =
  /^(.+?)\s+(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+(\d{1,2})\s+cuotas?$/i
// "12 cuotas de 25000" → valor por cuota sin descripción.
const INSTALLMENT_VALUE_BARE_PATTERN = /^(\d{1,2})\s+cuotas?\s+de\s+(\$?\s*[\d.,]+)$/i
// "Heladera 12 cuotas de 25000" / "Heladera en 12 cuotas de 25000"
// → descripción + valor por cuota.
const INSTALLMENT_VALUE_PATTERN =
  /^(.+?)\s+(?:en\s+)?(\d{1,2})\s+cuotas?\s+de\s+(\$?\s*[\d.,]+)$/i

/**
 * "Heladera 200000 en 12 cuotas", "Heladera 200000 12 cuotas",
 * "Compra TV 450000 6 cuotas" o "Compra 200000 12 cuotas". Se evalúa
 * primero el conector "en", después el formato con verbo (que ya no lleva
 * descripción) y por último el formato sin conector (que admite
 * descripción y le saca el verbo de compra si lo trae adelante).
 *
 * Además se distingue el monto TOTAL del VALOR por cuota: "12 cuotas de
 * 25000" significa que cada cuota vale $25.000 (total = 25000 × 12); "en
 * 12 cuotas" con un monto antes significa que ese monto es el total
 * (valor por cuota = total ÷ 12). Ambos quedan expuestos en
 * `totalAmount` e `installmentAmount`.
 */
function parseInstallment(text: string): ParsedInstallment | null {
  const valueBareMatch = text.match(INSTALLMENT_VALUE_BARE_PATTERN)
  if (valueBareMatch) {
    const amount = extractAmount(valueBareMatch[2].replace('$', '').trim())
    const count = Number(valueBareMatch[1])
    if (amount === null || amount <= 0 || count <= 0) return null
    return {
      kind: 'installment',
      description: 'Compra en cuotas',
      totalAmount: amount * count,
      installmentsCount: count,
      installmentAmount: amount,
      notes: null,
    }
  }

  const valueMatch = text.match(INSTALLMENT_VALUE_PATTERN)
  if (valueMatch) {
    const amount = extractAmount(valueMatch[3].replace('$', '').trim())
    const count = Number(valueMatch[2])
    if (amount === null || amount <= 0 || count <= 0) return null
    const description = cleanName(
      extractDescription(valueMatch[1], amount, 'Compra en cuotas').replace(/^(?:compré|compre|comprar|compra)\s+/i, '')
    )
    return {
      kind: 'installment',
      description: description || 'Compra en cuotas',
      totalAmount: amount * count,
      installmentsCount: count,
      installmentAmount: amount,
      notes: null,
    }
  }

  const enMatch = text.match(INSTALLMENT_EN_PATTERN)
  if (enMatch) {
    const amount = extractAmount(enMatch[1])
    const count = Number(enMatch[2])
    if (amount === null || amount <= 0 || count <= 0) return null
    const description = extractDescription(enMatch[1], amount, 'Compra en cuotas')
    return {
      kind: 'installment',
      description,
      totalAmount: amount,
      installmentsCount: count,
      installmentAmount: count > 0 ? amount / count : amount,
      notes: null,
    }
  }

  const verbMatch = text.match(INSTALLMENT_VERB_PATTERN)
  if (verbMatch) {
    const amount = extractAmount(verbMatch[1])
    const count = Number(verbMatch[2])
    if (amount === null || amount <= 0 || count <= 0) return null
    return {
      kind: 'installment',
      description: 'Compra en cuotas',
      totalAmount: amount,
      installmentsCount: count,
      installmentAmount: count > 0 ? amount / count : amount,
      notes: null,
    }
  }

  const noEnMatch = text.match(INSTALLMENT_NO_EN_PATTERN)
  if (noEnMatch) {
    const amount = extractAmount(noEnMatch[2])
    const count = Number(noEnMatch[3])
    if (amount === null || amount <= 0 || count <= 0) return null
    const description = cleanName(
      extractDescription(noEnMatch[1], amount, 'Compra en cuotas').replace(/^(?:compré|compre|comprar|compra)\s+/i, '')
    )
    return {
      kind: 'installment',
      description: description || 'Compra en cuotas',
      totalAmount: amount,
      installmentsCount: count,
      installmentAmount: count > 0 ? amount / count : amount,
      notes: null,
    }
  }

  return null
}

/**
 * "Pagué cuota Galicia 150000", "Pago cuota Prestamo Provincia",
 * "Pagué 150000 cuota Galicia" o "Pago 1 cuota Heladera" — registra el
 * pago de una cuota de una compra existente. El monto es opcional
 * (si no se pasa, el handler usa el monto de la cuota según el plan); el
 * número de cuota es opcional también ("Pago 3 cuota X" paga esa cuota,
 * si no, la próxima impaga). Un número pequeño (≤ 60) antes de "cuota"
 * se interpreta como número de cuota; un número grande, como monto.
 */
function parseInstallmentPayment(text: string): ParsedTelegramMessage | null {
  // "Pago cuota Prestamo Provincia" / "Pago cuota Galicia 150000"
  const pagoCuotaMatch = text.match(/^pago\s+cuota\s+(.+)$/i)
  if (pagoCuotaMatch) {
    const amount = extractAmount(pagoCuotaMatch[1])
    const purchaseName = cleanName(stripAmount(pagoCuotaMatch[1]))
    if (!purchaseName) return null
    return { kind: 'installment_payment', amount, purchaseName, installmentNumber: null }
  }

  // "Pagué cuota Galicia 150000"
  const pagueCuotaMatch = text.match(/^pagu(?:é|e)\s+cuota\s+(.+)$/i)
  if (pagueCuotaMatch) {
    const amount = extractAmount(pagueCuotaMatch[1])
    const purchaseName = cleanName(stripAmount(pagueCuotaMatch[1]))
    if (!purchaseName) return null
    return { kind: 'installment_payment', amount, purchaseName, installmentNumber: null }
  }

  // "Pago 1 cuota Heladera" / "Pago 150000 cuota Galicia"
  const pagoNumeroCuotaMatch = text.match(
    /^pago\s+(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+cuota\s+(.+)$/i
  )
  if (pagoNumeroCuotaMatch) {
    const n = extractAmount(pagoNumeroCuotaMatch[1])
    const purchaseName = cleanName(pagoNumeroCuotaMatch[2])
    if (n === null || n <= 0 || !purchaseName) return null
    if (n <= 60 && Number.isInteger(n)) {
      return { kind: 'installment_payment', amount: null, purchaseName, installmentNumber: n }
    }
    return { kind: 'installment_payment', amount: n, purchaseName, installmentNumber: null }
  }

  // "Pagué 150000 cuota Galicia"
  const pagueMontoCuotaMatch = text.match(
    /^pagu(?:é|e)\s+(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s+cuota\s+(.+)$/i
  )
  if (pagueMontoCuotaMatch) {
    const amount = extractAmount(pagueMontoCuotaMatch[1])
    const purchaseName = cleanName(pagueMontoCuotaMatch[2])
    if (amount === null || amount <= 0 || !purchaseName) return null
    return { kind: 'installment_payment', amount, purchaseName, installmentNumber: null }
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
 * /fijos, /consejos, /hogar, /plan, /pro, /billeteras, /vencimientos,
 * /resumen, /gastos, /ayuda), el texto de un botón del teclado principal
 * ("💳 Billeteras", "📅 Vencimientos", ...), un código de vinculación
 * (6 dígitos, con o sin "/start" adelante) o una intención en texto
 * libre: gasto ("Gasto 4500 café"), deuda ("Debo 5000 a Juan"), pago de
 * deuda ("Pagué 5000 a Juan", "Cobré 3000 de Pedro"), pago de servicio
 * ("Pago servicio Netflix 5000", "Pagué Netflix 5000"), pago de cuota
 * ("Pagué cuota Galicia 150000", "Pago 1 cuota Heladera"), cuotas
 * ("Heladera 200000 en 12 cuotas" o "Heladera 200000 12 cuotas"), gasto
 * fijo/suscripción ("Suscripción 5000 Netflix") o meta de ahorro
 * ("Meta Vacaciones 200000").
 */
export function parseTelegramMessage(text: string): ParsedTelegramMessage {
  const trimmed = text.trim()

  // Botones del teclado principal: el texto exacto que envía cada botón
  // se mapea al comando equivalente antes de buscar comandos "/".
  const normalizedButton = trimmed.toLowerCase().replace(/\s+/g, ' ')
  for (const entry of REPLY_BUTTON_COMMANDS) {
    if (normalizedButton === entry.label) {
      return { kind: 'command', command: entry.command }
    }
  }

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

  // Una nota libre ("nota: ..." o "(...)") al final se saca del texto
  // antes de parsear la intención y se le adjunta al resultado cuando la
  // entidad lo soporta (gasto, deuda o compra en cuotas).
  const { notes, rest } = extractNotes(trimmed)

  // Las intenciones en texto libre se evalúan ANTES del gasto genérico:
  // deuda ("Debo... a..." / "Me debe..."), pago de cuota ("Pago cuota
  // X", "Pago N cuota X", "Pagué [monto] cuota X"), pagos de deudas
  // ("Pagué X a Y", "Cobré X de Y", "Pago deuda...", "Pago X Y"), pagos
  // de servicios ("Pago servicio...", "Pagué <servicio> <monto>"),
  // cuotas ("... en N cuotas" o "... N cuotas"), fijos/suscripciones
  // ("Suscripción...", "Alquiler...", "... mensual") y metas ("Meta...",
  // "Ahorrar... para...").
  const debt = parseDebt(rest)
  if (debt) return { ...debt, notes }

  // El pago de cuota se evalúa ANTES que el pago de deuda y el pago de
  // servicio: "Pago cuota X", "Pago 1 cuota X" y "Pagué 150000 cuota X"
  // empezarían como pago de deuda ("pago X Y") o de servicio ("pagué X")
  // si no se revisara primero.
  const installmentPayment = parseInstallmentPayment(rest)
  if (installmentPayment) return installmentPayment

  const debtPayment = parseDebtPayment(rest)
  if (debtPayment) return debtPayment

  const recurringPayment = parseRecurringPayment(rest)
  if (recurringPayment) return recurringPayment

  const installment = parseInstallment(rest)
  if (installment) return { ...installment, notes }

  const recurring = parseRecurring(rest)
  if (recurring) return recurring

  const savingsGoal = parseSavingsGoal(rest)
  if (savingsGoal) return savingsGoal

  const amount = extractAmount(rest)
  if (amount === null || amount <= 0) {
    return { kind: 'unrecognized' }
  }

  const type = detectExpenseType(rest)
  return {
    kind: 'expense',
    amount,
    description: extractDescription(rest, amount, type === 'income' ? 'Ingreso por Telegram' : 'Gasto por Telegram'),
    type,
    wallet: extractWalletHint(rest),
    categoryHint: detectCategoryHint(rest),
    notes,
  }
}
