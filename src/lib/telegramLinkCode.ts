/**
 * Genera un código numérico de 6 dígitos (con ceros a la izquierda si
 * hace falta) para vincular la cuenta con el bot de Telegram. Función
 * pura para poder testear que siempre tiene el formato esperado.
 */
export function generateLinkingCode(): string {
  const num = Math.floor(Math.random() * 1_000_000)
  return String(num).padStart(6, '0')
}
