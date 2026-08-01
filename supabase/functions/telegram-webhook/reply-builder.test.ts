import { describe, it, expect } from 'vitest'
import {
  buildExpenseConfirmedReply,
  buildGastadoReply,
  buildHelpReply,
  buildLinkErrorReply,
  buildLinkInvalidReply,
  buildLinkSuccessReply,
  buildNotLinkedReply,
  buildSafeToSpendReply,
  buildSaldoReply,
  buildUnknownCommandReply,
  buildUnrecognizedReply,
  computeSafeToSpend,
  formatArs,
  getDaysRemainingInMonth,
  monthlyEquivalentAmount,
} from './reply-builder'

describe('formatArs', () => {
  it('formatea montos enteros con separador de miles', () => {
    expect(formatArs(4500)).toBe('$4.500')
  })

  it('formatea montos con decimales usando coma', () => {
    expect(formatArs(1500.5)).toBe('$1.500,5')
  })

  it('formatea cero', () => {
    expect(formatArs(0)).toBe('$0')
  })

  it('maneja números negativos', () => {
    expect(formatArs(-2500)).toBe('$-2.500')
  })
})

describe('monthlyEquivalentAmount', () => {
  it('prorratea los anuales a su equivalente mensual', () => {
    expect(monthlyEquivalentAmount(120000, 'annual')).toBe(10000)
  })

  it('deja los mensuales igual', () => {
    expect(monthlyEquivalentAmount(10000, 'monthly')).toBe(10000)
  })
})

describe('getDaysRemainingInMonth', () => {
  it('cuenta hoy como día disponible', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 0, 1))).toBe(31)
  })

  it('a mitad de mes devuelve los días que quedan contando hoy', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 0, 15))).toBe(17)
  })

  it('en el último día del mes devuelve 1', () => {
    expect(getDaysRemainingInMonth(new Date(2026, 0, 31))).toBe(1)
  })
})

describe('computeSafeToSpend', () => {
  const base = {
    totalBalance: 100000,
    monthlyFixedCommitments: 30000,
    budgetedAllocations: 10000,
    savingsContributions: 5000,
    installmentCommitments: 5000,
    monthlyIncome: 300000,
    daysRemaining: 10,
  }

  it('verde cuando sobra margen', () => {
    const result = computeSafeToSpend(base)
    expect(result.status).toBe('safe')
    expect(result.availableBalance).toBe(50000)
    expect(result.dailyLimit).toBe(5000)
  })

  it('ajustado cuando el límite diario queda por debajo del umbral', () => {
    // Umbral ajustado = (300000 / 30) * 0.1 = 1000/día.
    // disponible = 15000, días = 10 → límite diario 1500 → por encima del umbral, es safe.
    // Bajamos el ingreso a 3000000... no: subimos el umbral con más ingreso.
    const tight = computeSafeToSpend({
      ...base,
      totalBalance: 65000,
      monthlyIncome: 3000000,
    })
    // disponible = 65000 - 50000 = 15000, días = 10 → límite diario 1500.
    // umbral = (3000000 / 30) * 0.1 = 10000 → 1500 < 10000 → tight.
    expect(tight.status).toBe('tight')
  })

  it('sobregastado cuando los compromisos superan el balance', () => {
    const result = computeSafeToSpend({ ...base, totalBalance: 20000 })
    expect(result.status).toBe('over')
    expect(result.dailyLimit).toBe(0)
  })

  it('no divide por cero cuando no quedan días', () => {
    const result = computeSafeToSpend({ ...base, daysRemaining: 0 })
    expect(result.dailyLimit).toBe(50000)
    expect(Number.isFinite(result.dailyLimit)).toBe(true)
  })
})

describe('buildSaldoReply', () => {
  it('muestra el saldo y la cantidad de billeteras', () => {
    expect(buildSaldoReply(85000, 2)).toBe('Tu saldo total es $85.000 (sumando tus 2 billeteras).')
  })

  it('usa singular para una sola billetera', () => {
    expect(buildSaldoReply(85000, 1)).toContain('tus 1 billetera')
  })

  it('avisa si no hay billeteras', () => {
    expect(buildSaldoReply(0, 0)).toContain('Todavía no creaste ninguna billetera')
  })
})

describe('buildGastadoReply', () => {
  it('muestra el gasto del mes', () => {
    expect(buildGastadoReply(45000, 0)).toContain('Gastaste $45.000 este mes')
  })

  it('muestra el porcentaje del ingreso cuando hay ingreso', () => {
    expect(buildGastadoReply(45000, 150000)).toBe(
      'Gastaste $45.000 este mes. Eso es el 30% de tu ingreso del mes ($150.000).'
    )
  })

  it('sugiere cargar el ingreso si no hay', () => {
    expect(buildGastadoReply(45000, 0)).toContain('Cargá tu ingreso mensual')
  })
})

describe('buildSafeToSpendReply', () => {
  it('arma el mensaje con límite diario y disponible', () => {
    const reply = buildSafeToSpendReply(
      { availableBalance: 50000, dailyLimit: 5000, daysRemaining: 10, status: 'safe' },
      100000
    )
    expect(reply).toContain('$5.000')
    expect(reply).toContain('$100.000')
    expect(reply).toContain('10 días')
  })

  it('avisa cuando está sobregastado', () => {
    const reply = buildSafeToSpendReply(
      { availableBalance: -5000, dailyLimit: 0, daysRemaining: 10, status: 'over' },
      100000
    )
    expect(reply).toContain('Sobregastado')
    expect(reply).toContain('superan el balance disponible')
  })
})

describe('mensajes de texto', () => {
  it('buildHelpReply lista los comandos', () => {
    const help = buildHelpReply()
    expect(help).toContain('/saldo')
    expect(help).toContain('/gastado')
    expect(help).toContain('/safetospend')
    expect(help).toContain('/ayuda')
  })

  it('buildExpenseConfirmedReply confirma el gasto con monto y descripción', () => {
    expect(buildExpenseConfirmedReply(4500, 'café')).toBe('Listo ✅ Registré un gasto de $4.500 en "café".')
  })

  it('buildUnknownCommandReply menciona el comando recibido', () => {
    expect(buildUnknownCommandReply('hola')).toContain('/hola')
    expect(buildUnknownCommandReply('hola')).toContain('/ayuda')
  })

  it('los mensajes de vínculo y error existen', () => {
    expect(buildLinkSuccessReply()).toContain('vinculado')
    expect(buildLinkInvalidReply()).toContain('no es válido')
    expect(buildLinkErrorReply()).toContain('error')
    expect(buildNotLinkedReply()).toContain('no vinculaste')
    expect(buildUnrecognizedReply()).toContain('No entendí')
  })
})
