export type CalculatorOperator = '+' | '-' | '×' | '÷'

/**
 * Aplica una operación aritmética básica. Función pura, separada de la
 * UI para poder testearla (incluyendo el caso de división por cero).
 */
export function applyOperator(a: number, b: number, operator: CalculatorOperator): number {
  switch (operator) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? NaN : a / b
  }
}

const SYMBOL_TO_OPERATOR: Record<string, CalculatorOperator> = { '+': '+', '-': '-', '*': '×', '/': '÷' }

/**
 * Evalúa una expresión matemática simple escrita a mano en un campo de
 * monto (ej. "2500 + 1300", "2500*3 - 500"). Devuelve null si el texto
 * no es una expresión reconocible (ej. está vacío, es un solo número
 * sin operadores, o tiene un formato inválido) — en esos casos el
 * campo se deja tal cual, no se lo toca.
 *
 * Respeta la precedencia matemática habitual (multiplicación/división
 * antes que suma/resta), reutilizando applyOperator() para cada paso
 * en vez de usar eval() (nunca se evalúa código arbitrario del
 * usuario).
 */
export function evaluateMathExpression(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Tiene que haber al menos un operador — si es solo un número, no es
  // una "expresión" que evaluar, es el monto tal cual.
  if (!/[+\-*/]/.test(trimmed)) return null

  // Tokeniza en números y operadores. Solo acepta dígitos, un punto
  // decimal opcional, espacios y los 4 operadores — cualquier otro
  // carácter invalida la expresión entera (nada de intentar adivinar).
  const cleaned = trimmed.replace(/\s+/g, '')
  if (!/^\d+(\.\d+)?([+\-*/]\d+(\.\d+)?)+$/.test(cleaned)) return null

  const tokens = cleaned.match(/\d+(\.\d+)?|[+\-*/]/g)
  if (!tokens || tokens.length < 3) return null

  // Primera pasada: resolvemos × y ÷ de izquierda a derecha.
  const pass1: (number | CalculatorOperator)[] = [Number(tokens[0])]
  for (let i = 1; i < tokens.length; i += 2) {
    const symbol = tokens[i]
    const nextNum = Number(tokens[i + 1])
    if (symbol === '*' || symbol === '/') {
      const prev = pass1.pop() as number
      pass1.push(applyOperator(prev, nextNum, SYMBOL_TO_OPERATOR[symbol]))
    } else {
      pass1.push(SYMBOL_TO_OPERATOR[symbol], nextNum)
    }
  }

  // Segunda pasada: + y - de izquierda a derecha sobre lo que quedó.
  let result = pass1[0] as number
  for (let i = 1; i < pass1.length; i += 2) {
    const operator = pass1[i] as CalculatorOperator
    const num = pass1[i + 1] as number
    result = applyOperator(result, num, operator)
  }

  return Number.isFinite(result) ? Math.round(result * 100) / 100 : null
}
