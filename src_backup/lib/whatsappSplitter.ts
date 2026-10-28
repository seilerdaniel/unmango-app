import { buildWhatsAppLink } from './splitExpense'

export interface GenerateWhatsAppSplitTextParams {
  /** Título/descripción del gasto (ej. "Cena en Coto"). */
  title: string
  /** Monto total a dividir. */
  totalAmount: number
  /** Cantidad de personas entre las que se divide (incluye a quien pagó). */
  participantsCount: number
  /** Alias / CBU / link de Mercado Pago cargado en la cuenta del usuario. */
  paymentDetails?: string
  /** Teléfono opcional para el link de wa.me (si no, abre el selector de contacto). */
  phone?: string
}

export interface WhatsAppSplitResult {
  /** Lo que le toca pagar a cada persona (redondeado a 2 decimales). */
  perPersonAmount: number
  /** true si el total se divide exacto (sin resto); false si se redondeó. */
  exactDivision: boolean
  /** Mensaje en texto plano con emojis, listo para pegar/copiar. */
  message: string
  /** URL codificada para abrir WhatsApp con el mensaje precargado. */
  url: string
}

const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
})

/**
 * Formatea un monto en ARS (es-AR) para los mensajes. Se exporta para que
 * los tests asienten contra el mismo formato sin duplicar la lógica.
 */
export function formatArs(amount: number): string {
  return ARS_FORMATTER.format(amount)
}

/**
 * Genera la tarjeta de cobro por WhatsApp para un gasto dividido en
 * partes iguales: calcula cuánto le toca a cada uno (manejando centavos),
 * arma el mensaje de texto plano con emojis y devuelve tanto el mensaje
 * como la URL de wa.me codificada. Función pura, sin estado.
 *
 * Si la división no es exacta, el monto por persona se redondea a 2
 * decimales y el mensaje lo aclara (el total redondeado puede no sumar
 * exacto).
 */
export function generateWhatsAppSplitText(params: GenerateWhatsAppSplitTextParams): WhatsAppSplitResult {
  const title = params.title.trim() || 'gasto compartido'
  const totalAmount = params.totalAmount
  const people = params.participantsCount > 0 ? params.participantsCount : 1

  const exactShare = totalAmount / people
  const perPersonAmount = Math.round(exactShare * 100) / 100
  const exactDivision = Math.abs(perPersonAmount - exactShare) < 1e-9

  const lines: string[] = []
  lines.push(`Hola 👋 Te paso el gasto: "${title}" 🧾`)
  lines.push(`💰 Total: ${formatArs(totalAmount)}`)
  lines.push(`👥 Entre ${people}: ${formatArs(perPersonAmount)} cada uno`)

  if (!exactDivision) {
    lines.push('ℹ️ Montos redondeados a 2 decimales')
  }

  if (params.paymentDetails?.trim()) {
    lines.push(`💳 Datos para transferir: ${params.paymentDetails.trim()}`)
  }

  lines.push('📲 Transferime tu parte 🙌')

  const message = lines.join('\n')
  return {
    perPersonAmount,
    exactDivision,
    message,
    url: buildWhatsAppLink(message, params.phone),
  }
}
