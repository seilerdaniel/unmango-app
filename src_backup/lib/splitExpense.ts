/**
 * Divide un gasto total entre N personas en partes iguales (incluyendo
 * a quien pagó). Redondea a 2 decimales — repartir centavos exactos
 * entre varias personas casi nunca da un número redondo.
 */
export function computeSplitShare(totalAmount: number, peopleCount: number): number {
  if (peopleCount <= 0) return 0
  return Math.round((totalAmount / peopleCount) * 100) / 100
}

/**
 * Arma el texto del mensaje de WhatsApp pidiendo la parte que le toca a
 * alguien de un gasto compartido. El alias bancario es opcional — si no
 * se pasa, el mensaje simplemente no lo menciona (la persona lo puede
 * agregar a mano antes de enviar).
 */
export function buildSplitExpenseMessage(
  description: string,
  formattedAmount: string,
  bankAlias?: string
): string {
  const aliasLine = bankAlias ? `\nAlias: ${bankAlias}` : ''
  return `Hola! Te paso el resumen de "${description}": te toca ${formattedAmount}.${aliasLine}`
}

/**
 * Arma la URL de wa.me para abrir WhatsApp con el mensaje precargado.
 * Si no se pasa un teléfono, abre el selector de contacto de WhatsApp
 * (el usuario elige a quién mandárselo desde ahí).
 */
export function buildWhatsAppLink(message: string, phone?: string): string {
  const encoded = encodeURIComponent(message)
  return phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}
