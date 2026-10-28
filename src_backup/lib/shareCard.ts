export interface ShareStats {
  balance: number
  totalIncome: number
  totalExpense: number
  monthLabel: string
}

export interface ShareLine {
  label: string
  value: string
}

/**
 * Arma las líneas de texto de la tarjeta para compartir. Si
 * `revealAmounts` es false (el default, para que compartir sea
 * "seguro" por defecto), los montos se censuran. Función pura,
 * separada del dibujo en <canvas> para poder testearla (jsdom no
 * implementa canvas, así que el dibujo en sí no es testeable, pero esta
 * lógica sí).
 */
export function buildShareCardLines(
  stats: ShareStats,
  revealAmounts: boolean,
  formatAmount: (n: number) => string
): ShareLine[] {
  const mask = '••••••'
  return [
    { label: 'Balance', value: revealAmounts ? formatAmount(stats.balance) : mask },
    { label: 'Ingresos', value: revealAmounts ? formatAmount(stats.totalIncome) : mask },
    { label: 'Gastos', value: revealAmounts ? formatAmount(stats.totalExpense) : mask },
    { label: 'Período', value: stats.monthLabel },
  ]
}
