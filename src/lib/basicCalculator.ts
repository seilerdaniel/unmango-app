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
