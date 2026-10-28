const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para que no se confundan al leerlo

/**
 * Genera un código de invitación alfanumérico de 8 caracteres. Más
 * largo que el código de 6 dígitos de Telegram a propósito — acá se
 * comparte acceso a datos financieros de dos cuentas, conviene que sea
 * menos adivinable.
 */
export function generateHouseholdInviteCode(): string {
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}
