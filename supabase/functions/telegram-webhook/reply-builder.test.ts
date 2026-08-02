import { describe, it, expect } from 'vitest'
import {
  applyTax,
  round2,
  walletDailyYield,
  walletMonthlyYield,
  extractReferenceRates,
  calculateRoundUp,
  computeTotalRoundUpSavings,
  buildBilleterasReply,
  buildConsejosReply,
  buildCuotasPayload,
  buildCuotasReply,
  buildDebtConfirmedReply,
  buildDebtPaymentConfirmedReply,
  buildDebtPaymentNotFoundReply,
  buildDebtsPayload,
  buildDebtsReply,
  buildExpenseCategorySlices,
  buildExpenseConfirmedReply,
  buildFijosReply,
  buildGastadoReply,
  buildHelpReply,
  buildHogarReply,
  buildInstallmentConfirmedReply,
  buildInstallmentPaymentAlreadyPaidReply,
  buildInstallmentPaymentConfirmedReply,
  buildInstallmentPaymentNotFoundReply,
  buildLinkErrorReply,
  buildLinkInvalidReply,
  buildLinkSuccessReply,
  buildMainReplyKeyboard,
  buildMetasReply,
  buildNotLinkedReply,
  buildQuickChartPieUrl,
  buildRecurringConfirmedReply,
  buildRecurringPaymentConfirmedReply,
  buildRecurringPaymentNotFoundReply,
  buildResumenCaption,
  buildSafeToSpendReply,
  buildSaldoReply,
  buildSaveErrorReply,
  buildSavingsGoalConfirmedReply,
  buildScoreReply,
  buildSetMyCommandsPayload,
  buildUnknownCommandReply,
  buildUnrecognizedReply,
  buildVencimientosPayload,
  buildVencimientosReply,
  computeFinancialHealthScore,
  computeHouseholdBalance,
  computeInstallmentScheduleItems,
  computeSafeToSpend,
  computeStreakBreak,
  computeUpcomingDueItems,
  computeWalletBalances,
  detectAntExpenses,
  formatArs,
  formatMoney,
  generateAdviceMessages,
  getDaysRemainingInMonth,
  hasNoFinancialData,
  isGoalStalled,
  monthlyEquivalentAmount,
  nextBillingDate,
} from './reply-builder'
import type { InlineKeyboardMarkup } from './reply-builder'

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

  it('redondea a 2 decimales los anuales no divisibles', () => {
    expect(monthlyEquivalentAmount(100000, 'annual')).toBe(8333.33)
  })

  it('deja los mensuales igual', () => {
    expect(monthlyEquivalentAmount(10000, 'monthly')).toBe(10000)
  })
})

describe('applyTax / round2', () => {
  it('aplica el impuesto y redondea a 2 decimales', () => {
    expect(applyTax(999.99, 21)).toBe(1209.99)
    expect(applyTax(1200, 5)).toBe(1260)
  })

  it('devuelve el monto base si el impuesto es 0 o negativo', () => {
    expect(applyTax(1000, 0)).toBe(1000)
    expect(applyTax(1000, -5)).toBe(1000)
  })

  it('round2 elimina el ruido de coma flotante', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(3.3333)).toBe(3.33)
    expect(round2(0)).toBe(0)
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

  it('buildExpenseConfirmedReply distingue ingreso de gasto', () => {
    expect(buildExpenseConfirmedReply(200000, 'Mercado Pago', 'income')).toContain('Registré un ingreso de $200.000')
    expect(buildExpenseConfirmedReply(4500, 'café', 'expense')).toContain('Registré un gasto de $4.500')
  })

  it('buildExpenseConfirmedReply incluye billetera, categoría y nota', () => {
    const reply = buildExpenseConfirmedReply(5000, 'café', 'expense', 'Mercado Pago', 'Transporte', 'salida con amigos')
    expect(reply).toContain('billetera Mercado Pago')
    expect(reply).toContain('categoría Transporte')
    expect(reply).toContain('Nota: salida con amigos')
  })

  it('buildExpenseConfirmedReply suma la nota del Bolsillo de Cambio', () => {
    const reply = buildExpenseConfirmedReply(3200, 'café', 'expense', null, null, null, { amount: 800, total: 4000 })
    expect(reply).toContain('💡 +$800 asignados al Bolsillo de Cambio ($4.000 este mes).')
  })

  it('buildExpenseConfirmedReply omite la nota si el redondeo es 0', () => {
    const reply = buildExpenseConfirmedReply(3200, 'café', 'expense', null, null, null, { amount: 0, total: 4000 })
    expect(reply).not.toContain('Bolsillo de Cambio')
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

  it('buildHelpReply lista los comandos nuevos', () => {
    const help = buildHelpReply()
    expect(help).toContain('/score')
    expect(help).toContain('/deudas')
    expect(help).toContain('/cuotas')
    expect(help).toContain('/metas')
    expect(help).toContain('/fijos')
    expect(help).toContain('/consejos')
    expect(help).toContain('/hogar')
    expect(help).toContain('/billeteras')
    expect(help).toContain('/vencimientos')
    expect(help).toContain('Pagué 5000 a Juan')
    expect(help).toContain('Pago servicio Netflix 5000')
    expect(help).toContain('Heladera 200000 12 cuotas')
    expect(help).toContain('Pagué cuota Galicia 150000')
    expect(help).toContain('Pago 1 cuota Heladera')
  })
})

describe('calculateRoundUp / computeTotalRoundUpSavings (réplica del frontend)', () => {
  it('redondea al múltiplo superior del paso por defecto ($1.000)', () => {
    expect(calculateRoundUp(3200)).toBe(800)
    expect(calculateRoundUp(1500)).toBe(500)
    expect(calculateRoundUp(4000)).toBe(0)
  })

  it('respeta pasos de $100 y $500', () => {
    expect(calculateRoundUp(3250, 100)).toBe(50)
    expect(calculateRoundUp(3250, 500)).toBe(250)
  })

  it('devuelve 0 con montos inválidos o pasos no positivos', () => {
    expect(calculateRoundUp(-1500)).toBe(0)
    expect(calculateRoundUp(3200, 0)).toBe(0)
  })

  it('suma el redondeo de todos los gastos del mes', () => {
    expect(computeTotalRoundUpSavings([3200, 1500, 4000])).toBe(1300)
    expect(computeTotalRoundUpSavings([null, 3200], 1000)).toBe(800)
    expect(computeTotalRoundUpSavings([])).toBe(0)
  })
})

describe('formatMoney', () => {
  it('formatea ARS con formato local', () => {
    expect(formatMoney(4500, 'ARS')).toBe('$4.500')
  })

  it('formatea USD con prefijo US$', () => {
    expect(formatMoney(1500, 'USD')).toBe('US$1,500')
  })
})

describe('computeFinancialHealthScore', () => {
  it('calcula un score equilibrado', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 300000,
      monthlyExpense: 150000,
      monthlyDebtPayments: 30000,
      emergencyFundBalance: 600000,
      antExpensesTotal: 0,
    })
    // Ahorro 50, Deuda 90, Fondo 67 (4 meses = 66.67 → 67), Hormiga 100 → (50+90+67+100)/4 = 76.75 → 77
    expect(result.totalScore).toBe(77)
    expect(result.pillars.savings.score).toBe(50)
    expect(result.pillars.debt.score).toBe(90)
    expect(result.pillars.emergencyFund.score).toBe(67)
    expect(result.pillars.antExpenses.score).toBe(100)
  })

  it('deja el score bajo cuando los gastos superan el ingreso', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 200000,
      monthlyDebtPayments: 50000,
      emergencyFundBalance: 0,
      antExpensesTotal: 10000,
    })
    // Ahorro 0, Deuda 50, Fondo 0, Hormiga 50 → (0+50+0+50)/4 = 25
    expect(result.totalScore).toBe(25)
    expect(result.pillars.savings.score).toBe(0)
  })
})

describe('hasNoFinancialData', () => {
  it('true si no hay ingreso ni gasto', () => {
    expect(hasNoFinancialData(0, 0)).toBe(true)
    expect(hasNoFinancialData(1000, 0)).toBe(false)
  })
})

describe('computeHouseholdBalance', () => {
  it('calcula quién le debe a quién', () => {
    const balance = computeHouseholdBalance(200000, 100000)
    expect(balance.netBalanceForMe).toBe(50000)
    expect(balance.totalHouseholdExpenses).toBe(300000)
  })

  it('están a mano si pagaron lo mismo', () => {
    expect(computeHouseholdBalance(150000, 150000).netBalanceForMe).toBe(0)
  })
})

describe('detectAntExpenses', () => {
  it('suma solo los gastos por debajo del umbral', () => {
    const result = detectAntExpenses([{ amount: 500 }, { amount: 2000 }, { amount: 5000 }], 3000)
    expect(result.count).toBe(2)
    expect(result.total).toBe(2500)
  })
})

describe('isGoalStalled', () => {
  it('true si sigue en $0 después de 60 días', () => {
    const old = new Date()
    old.setDate(old.getDate() - 61)
    expect(isGoalStalled(0, old.toISOString(), new Date())).toBe(true)
  })

  it('false si tiene plata o si es reciente', () => {
    const old = new Date()
    old.setDate(old.getDate() - 61)
    expect(isGoalStalled(100, old.toISOString(), new Date())).toBe(false)
    expect(isGoalStalled(0, new Date().toISOString(), new Date())).toBe(false)
  })
})

describe('computeStreakBreak', () => {
  it('devuelve los días de racha previa si hoy se cortó', () => {
    const today = new Date(2026, 0, 10)
    // hubo gastos los días 3 y 10 → racha de 3-9 (6 días, sin contar el 10) rota el 10.
    expect(computeStreakBreak([3, 10], today)).toBe(6)
  })

  it('null si hoy no hubo gasto', () => {
    expect(computeStreakBreak([3], new Date(2026, 0, 10))).toBe(null)
  })
})

describe('generateAdviceMessages', () => {
  const healthyScore = computeFinancialHealthScore({
    monthlyIncome: 300000,
    monthlyExpense: 90000,
    monthlyDebtPayments: 60000,
    emergencyFundBalance: 450000,
    antExpensesTotal: 10000,
  })

  it('no genera mensajes cuando todo está en rango', () => {
    // Ahorro 70, Deuda 80, Fondo 83, Hormiga 83 → ningún umbral se dispara.
    const messages = generateAdviceMessages({
      healthScore: healthyScore,
      safeToSpendToday: 5000,
      hasSubscriptionPriceIncrease: false,
      exceededBudgetCategoryNames: [],
      hasHighInterestDebt: false,
      largeInstallmentDescription: null,
      brokenStreakDays: null,
      stalledGoalNames: [],
      hasNoCategories: false,
      hasExpensesButNoIncome: false,
      householdUnsettledDays: null,
    })
    expect(messages).toEqual([])
  })

  it('avisa cuando el ahorro está bajo', () => {
    const lowSavings = computeFinancialHealthScore({
      monthlyIncome: 100000,
      monthlyExpense: 95000,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    })
    const messages = generateAdviceMessages({
      healthScore: lowSavings,
      safeToSpendToday: null,
      hasSubscriptionPriceIncrease: false,
      exceededBudgetCategoryNames: [],
      hasHighInterestDebt: false,
      largeInstallmentDescription: null,
      brokenStreakDays: null,
      stalledGoalNames: [],
      hasNoCategories: false,
      hasExpensesButNoIncome: false,
      householdUnsettledDays: null,
    })
    expect(messages.join('\n')).toContain('Estás gastando casi todo lo que ganás')
  })
})

describe('buildScoreReply', () => {
  it('arma el mensaje con los 4 pilares', () => {
    const result = computeFinancialHealthScore({
      monthlyIncome: 300000,
      monthlyExpense: 150000,
      monthlyDebtPayments: 30000,
      emergencyFundBalance: 600000,
      antExpensesTotal: 0,
    })
    const reply = buildScoreReply(result, false)
    expect(reply).toContain('77/100')
    expect(reply).toContain('Ahorro')
    expect(reply).toContain('Fondo de Emergencia')
    expect(reply).toContain('Gasto Hormiga')
  })

  it('avisa si no hay datos', () => {
    expect(buildScoreReply(computeFinancialHealthScore({
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyDebtPayments: 0,
      emergencyFundBalance: 0,
      antExpensesTotal: 0,
    }), true)).toContain('no hay Score para calcular')
  })
})

describe('buildDebtsReply', () => {
  it('muestra las deudas con quien corresponde', () => {
    const reply = buildDebtsReply([
      { description: 'Deuda con Juan', counterpartyName: 'Juan', debtType: 'debo', totalAmount: 5000, remainingAmount: 5000, currency: 'ARS' },
      { description: 'Deuda con Pedro', counterpartyName: 'Pedro', debtType: 'me_deben', totalAmount: 3000, remainingAmount: 1000, currency: 'ARS' },
    ])
    expect(reply).toContain('le debés $5.000')
    expect(reply).toContain('te debe $3.000')
    expect(reply).toContain('quedan $1.000')
  })

  it('mensaje vacío si no hay deudas', () => {
    expect(buildDebtsReply([])).toContain('No tenés deudas')
  })
})

describe('buildCuotasReply', () => {
  it('muestra el detalle de cada compra', () => {
    const reply = buildCuotasReply([
      { description: 'Heladera', totalAmount: 200000, installmentsCount: 12, paidCount: 3, monthlyAmount: 16666.67 },
    ])
    expect(reply).toContain('Heladera')
    expect(reply).toContain('$200.000 en 12 cuotas')
    expect(reply).toContain('pagadas 3/12')
  })

  it('mensaje vacío si no hay cuotas', () => {
    expect(buildCuotasReply([])).toContain('No tenés compras en cuotas')
  })
})

describe('buildMetasReply', () => {
  it('muestra progreso y aporte mensual', () => {
    const reply = buildMetasReply([
      { name: 'Vacaciones', targetAmount: 200000, currentAmount: 50000, monthlyContribution: 10000 },
    ])
    expect(reply).toContain('Vacaciones')
    expect(reply).toContain('$50.000 de $200.000')
    expect(reply).toContain('(25%)')
    expect(reply).toContain('$10.000/mes')
  })
})

describe('buildFijosReply', () => {
  it('etiqueta suscripciones y gastos fijos', () => {
    const reply = buildFijosReply([
      { title: 'Netflix', amount: 5000, currency: 'ARS', expenseKind: 'subscription', billingFrequency: 'monthly', billingDay: 5 },
      { title: 'Alquiler', amount: 20000, currency: 'ARS', expenseKind: 'utility_rent', billingFrequency: 'monthly', billingDay: 1 },
    ])
    expect(reply).toContain('Netflix')
    expect(reply).toContain('[Suscripción]')
    expect(reply).toContain('[Gasto fijo]')
    expect(reply).toContain('vence el 5')
  })
})

describe('buildConsejosReply', () => {
  it('arma la lista de recomendaciones', () => {
    const reply = buildConsejosReply(['⚠️ Tu margen de ahorro es bajo.'], false)
    expect(reply).toContain('Tus recomendaciones')
    expect(reply).toContain('Tu margen de ahorro es bajo')
  })

  it('mensaje tranquilo si no hay alertas', () => {
    expect(buildConsejosReply([], false)).toContain('ninguna alerta puntual')
  })

  it('avisa si no hay datos', () => {
    expect(buildConsejosReply([], true)).toContain('no hay mucho para recomendar')
  })
})

describe('buildHogarReply', () => {
  it('sin hogar vinculado sugiere vincular', () => {
    expect(buildHogarReply(null, null)).toContain('Modo Hogar')
  })

  it('muestra quién le debe a quién', () => {
    const reply = buildHogarReply(
      computeHouseholdBalance(200000, 100000),
      45
    )
    expect(reply).toContain('Tu pareja te debe $50.000')
    expect(reply).toContain('Gastos de la casa')
    expect(reply).toContain('45 días')
  })
})

describe('confirmaciones nuevas', () => {
  it('buildDebtConfirmedReply según el tipo', () => {
    expect(buildDebtConfirmedReply('debo', 5000, 'Juan')).toBe('Listo ✅ Registré que le debés $5.000 a Juan.')
    expect(buildDebtConfirmedReply('me_deben', 3000, 'Pedro')).toBe('Listo ✅ Registré que Pedro te debe $3.000.')
  })

  it('buildDebtConfirmedReply incluye la nota si viene', () => {
    expect(buildDebtConfirmedReply('debo', 5000, 'Juan', 'para el viaje')).toContain('Nota: para el viaje')
  })

  it('buildInstallmentConfirmedReply muestra monto y cuota', () => {
    expect(buildInstallmentConfirmedReply('Heladera', 200000, 12)).toContain('12 cuotas de $16.666,67')
  })

  it('buildInstallmentConfirmedReply usa el valor por cuota si viene', () => {
    const reply = buildInstallmentConfirmedReply('Heladera', 300000, 12, 25000)
    expect(reply).toContain('12 cuotas de $25.000')
  })

  it('buildInstallmentConfirmedReply incluye la nota si viene', () => {
    expect(buildInstallmentConfirmedReply('Heladera', 200000, 12, null, 'adelanté el mes')).toContain(
      'Nota: adelanté el mes'
    )
  })

  it('buildRecurringConfirmedReply según el tipo', () => {
    expect(buildRecurringConfirmedReply('Netflix', 5000, 'subscription')).toContain('suscripción "Netflix"')
    expect(buildRecurringConfirmedReply('Alquiler', 20000, 'utility_rent')).toContain('gasto fijo "Alquiler"')
  })

  it('buildSavingsGoalConfirmedReply confirma la meta', () => {
    expect(buildSavingsGoalConfirmedReply('Vacaciones', 200000)).toContain('"Vacaciones"')
    expect(buildSavingsGoalConfirmedReply('Vacaciones', 200000)).toContain('$200.000')
  })

  it('buildSaveErrorReply existe', () => {
    expect(buildSaveErrorReply()).toContain('error')
  })
})

describe('confirmaciones de pago de cuota', () => {
  it('buildInstallmentPaymentConfirmedReply confirma la cuota pagada', () => {
    const reply = buildInstallmentPaymentConfirmedReply('Heladera', 3, 12, 15000, false)
    expect(reply).toContain('cuota 3/12')
    expect(reply).toContain('"Heladera"')
    expect(reply).toContain('$15.000')
    expect(reply).toContain('Gastos')
  })

  it('buildInstallmentPaymentConfirmedReply avisa cuando queda totalmente pagada', () => {
    const reply = buildInstallmentPaymentConfirmedReply('Heladera', 12, 12, 15000, true)
    expect(reply).toContain('cuota 12/12')
    expect(reply).toContain('totalmente pagada')
  })

  it('buildInstallmentPaymentNotFoundReply sugiere cómo registrar la compra', () => {
    const reply = buildInstallmentPaymentNotFoundReply('Galicia')
    expect(reply).toContain('Galicia')
    expect(reply).toContain('Heladera 200000 en 12 cuotas')
  })

  it('buildInstallmentPaymentAlreadyPaidReply avisa que no queda ninguna cuota', () => {
    const reply = buildInstallmentPaymentAlreadyPaidReply('Heladera', 12)
    expect(reply).toContain('12/12')
    expect(reply).toContain('No queda ninguna cuota por pagar')
  })
})

describe('buildBilleterasReply', () => {
  it('sin billeteras sugiere crear una', () => {
    expect(buildBilleterasReply([])).toContain('Todavía no creaste ninguna billetera')
  })

  it('muestra saldo, tipo y total', () => {
    const reply = buildBilleterasReply([
      { name: 'MercadoPago', type: 'virtual_wallet', balance: 25000, usdHeld: 0 },
      { name: 'Banco Nación', type: 'bank', balance: 100000, usdHeld: 0 },
      { name: 'Caja ahorro USD', type: 'bank', balance: 0, usdHeld: 150 },
    ])
    expect(reply).toContain('MercadoPago — $25.000 [Billetera Virtual]')
    expect(reply).toContain('Banco Nación — $100.000 [Banco]')
    expect(reply).toContain('(+ US$150)')
    expect(reply).toContain('Total: $125.000')
  })

  it('computeWalletBalances replica get_wallet_balances', () => {
    const rows = computeWalletBalances(
      [{ id: 'w1', name: 'Efectivo', type: 'cash', initialBalance: 1000 }],
      [
        { walletId: 'w1', type: 'income', amountArs: 5000, isUsd: false, amountUsd: null },
        { walletId: 'w1', type: 'expense', amountArs: 2000, isUsd: false, amountUsd: null },
        { walletId: null, type: 'expense', amountArs: 999, isUsd: false, amountUsd: null },
      ]
    )
    expect(rows[0].balance).toBe(4000)
  })

  it('computeWalletBalances propaga la TNA de cada billetera', () => {
    const rows = computeWalletBalances(
      [{ id: 'w1', name: 'Ualá', type: 'virtual_wallet', initialBalance: 1000, tna: 40 }],
      []
    )
    expect(rows[0].tnaPercentage).toBe(40)
  })

  it('muestra el rendimiento diario por billetera y la renta total estimada', () => {
    const reply = buildBilleterasReply([
      { name: 'MercadoPago', type: 'virtual_wallet', balance: 150000, usdHeld: 0, tnaPercentage: 38 },
      { name: 'Efectivo', type: 'cash', balance: 10000, usdHeld: 0, tnaPercentage: null },
    ])
    expect(reply).toContain('MercadoPago — $150.000 (TNA 38% → +$156,16/día) [Billetera Virtual]')
    expect(reply).toContain('Efectivo — $10.000 [Efectivo]')
    expect(reply).toContain('Renta diaria total estimada: $156,16/día')
  })

  it('walletDailyYield y walletMonthlyYield replican src/lib/walletYield.ts', () => {
    expect(walletDailyYield(100000, 36.5)).toBe(100)
    expect(walletDailyYield(150000, 38)).toBe(156.16)
    expect(walletDailyYield(50000, 0)).toBe(0)
    expect(walletMonthlyYield(100000, 12)).toBe(1000)
    expect(walletMonthlyYield(0, 40)).toBe(0)
  })

  it('listas cuentas en USD con su monto convertido y totales separados', () => {
    const reply = buildBilleterasReply(
      [
        { name: 'MercadoPago', type: 'virtual_wallet', balance: 150000, usdHeld: 0, tnaPercentage: 38 },
        { name: 'Caja USD', type: 'bank', balance: 1450000, usdHeld: 0, currency: 'USD' },
      ],
      { mepSell: 1450, blueSell: 1560, reference: 'blue' }
    )
    expect(reply).toContain('MercadoPago — $150.000 (TNA 38% → +$156,16/día) [Billetera Virtual]')
    expect(reply).toContain('Caja USD — US$929.49 [USD] [Banco]')
    expect(reply).toContain('Total ARS: $150.000')
    expect(reply).toContain('Total USD: US$929.49')
    expect(reply).toContain('Renta diaria total estimada: $156,16/día')
    expect(reply).toContain('Dólar MEP: $1.450 · Blue: $1.560')
  })

  it('sin cotizaciones no agrega la línea de dólar ni convierte USD', () => {
    const reply = buildBilleterasReply(
      [{ name: 'Caja USD', type: 'bank', balance: 1450000, usdHeld: 1000, currency: 'USD' }],
      null
    )
    expect(reply).toContain('Caja USD — US$1,000 [USD] [Banco]')
    expect(reply).toContain('Total ARS: $0')
    expect(reply).toContain('Total USD: US$1,450,000')
    expect(reply).not.toContain('Dólar MEP')
    expect(reply).not.toContain('Dólar Blue')
  })

  it('extractReferenceRates saca MEP y Blue de la respuesta de dolarapi', () => {
    const quotes = extractReferenceRates([
      { casa: 'bolsa', venta: 1450.5 },
      { casa: 'blue', venta: 1560 },
      { casa: 'oficial', venta: 1020 },
      { casa: 'tarjeta', venta: 1700 },
      { casa: 'bolsa', venta: 0 },
    ])
    expect(quotes.mepSell).toBe(1450.5)
    expect(quotes.blueSell).toBe(1560)
  })

  it('extractReferenceRates tolera respuestas vacías o raras', () => {
    expect(extractReferenceRates(null)).toEqual({ mepSell: null, blueSell: null })
    expect(extractReferenceRates([{}, { casa: 'blue', venta: null }])).toEqual({ mepSell: null, blueSell: null })
  })
})

describe('vencimientos', () => {
  const today = new Date(2026, 7, 1)

  it('nextBillingDate mensual vence este mes', () => {
    const next = nextBillingDate(15, 'monthly', null, today)
    expect(next.getDate()).toBe(15)
    expect(next.getMonth()).toBe(7)
  })

  it('nextBillingDate mensual vence el próximo mes si el día ya pasó', () => {
    const next = nextBillingDate(5, 'monthly', null, new Date(2026, 7, 15))
    expect(next.getMonth()).toBe(8)
    expect(next.getDate()).toBe(5)
  })

  it('nextBillingDate mensual clampea días inexistentes (31 → 30 en abril)', () => {
    const next = nextBillingDate(31, 'monthly', null, new Date(2026, 3, 1))
    expect(next.getDate()).toBe(30)
  })

  it('nextBillingDate anual respeta billing_month', () => {
    const next = nextBillingDate(10, 'annual', 12, today)
    expect(next.getMonth()).toBe(11)
    expect(next.getDate()).toBe(10)
  })

  it('computeInstallmentScheduleItems reparte el resto en la última cuota', () => {
    const items = computeInstallmentScheduleItems(1000, 3, new Date(2026, 0, 10))
    expect(items.map((i) => i.installmentNumber)).toEqual([1, 2, 3])
    expect(items.map((i) => i.amount)).toEqual([333.33, 333.33, 333.34])
    expect(items.reduce((acc, i) => acc + i.amount, 0)).toBe(1000)
  })

  it('computeUpcomingDueItems consolida fijos, cuotas y deudas ordenadas por fecha', () => {
    const items = computeUpcomingDueItems({
      recurring: [{ title: 'Netflix', amount: 5000, currency: 'ARS', billingDay: 20, billingFrequency: 'monthly', billingMonth: null }],
      installments: [
        { description: 'Heladera', totalAmount: 120000, installmentsCount: 12, firstInstallmentDate: '2026-07-15', paidInstallmentNumbers: [1] },
      ],
      debts: [
        { description: 'Préstamo', remainingAmount: 30000, currency: 'ARS', dueDate: '2026-08-25', debtType: 'debo' },
        { description: 'Crédito que me deben', remainingAmount: 99999, currency: 'ARS', dueDate: '2026-08-10', debtType: 'me_deben' },
      ],
      today,
    })
    expect(items.map((i) => i.kind)).toEqual(['cuota', 'fijo', 'deuda'])
    expect(items[0].detail).toBe('cuota 2/12')
  })

  it('computeUpcomingDueItems ignora lo que vence fuera de la ventana', () => {
    const items = computeUpcomingDueItems({
      recurring: [{ title: 'Seguro', amount: 10000, currency: 'ARS', billingDay: 15, billingFrequency: 'annual', billingMonth: 12 }],
      installments: [],
      debts: [],
      today,
    })
    expect(items).toEqual([])
  })

  it('buildVencimientosReply arma el listado con total ARS y USD', () => {
    const reply = buildVencimientosReply([
      { description: 'Netflix', dueDate: '2026-08-20', amount: 5000, currency: 'ARS', kind: 'fijo' },
      { description: 'Préstamo', dueDate: '2026-08-25', amount: 30000, currency: 'ARS', kind: 'deuda' },
      { description: 'Suscripción USD', dueDate: '2026-08-15', amount: 10, currency: 'USD', kind: 'fijo' },
    ])
    expect(reply).toContain('20/08 — Netflix — $5.000 [fijo]')
    expect(reply).toContain('25/08 — Préstamo — $30.000 [deuda]')
    expect(reply).toContain('15/08 — Suscripción USD — US$10 [fijo]')
    expect(reply).toContain('Total a pagar: $35.000')
    expect(reply).toContain('US$10')
  })

  it('buildVencimientosReply informa cuando no hay vencimientos', () => {
    expect(buildVencimientosReply([])).toContain('No tenés vencimientos')
  })
})

describe('confirmaciones de pagos', () => {
  it('buildDebtPaymentConfirmedReply para pago (pay) con saldo restante', () => {
    const reply = buildDebtPaymentConfirmedReply('pay', 10000, 'Silvana', 25000, 'ARS')
    expect(reply).toContain('un pago de $10.000 a Silvana')
    expect(reply).toContain('Quedan $25.000 de deuda')
    expect(reply).toContain('Lo sumé a tus Gastos')
  })

  it('buildDebtPaymentConfirmedReply avisa cuando la deuda quedó saldada', () => {
    const reply = buildDebtPaymentConfirmedReply('pay', 10000, 'Silvana', 0, 'ARS')
    expect(reply).toContain('totalmente saldada')
  })

  it('buildDebtPaymentConfirmedReply para cobro (collect) suma a Ingresos', () => {
    const reply = buildDebtPaymentConfirmedReply('collect', 5000, 'Pedro', 0, 'ARS')
    expect(reply).toContain('cobraste $5.000 de Pedro')
    expect(reply).toContain('Lo sumé a tus Ingresos')
  })

  it('buildDebtPaymentNotFoundReply avisa si no hay deuda con esa persona', () => {
    expect(buildDebtPaymentNotFoundReply('Silvana')).toContain('Silvana')
    expect(buildDebtPaymentNotFoundReply('Silvana')).toContain('No encontré')
  })

  it('buildRecurringPaymentConfirmedReply confirma y suma a Gastos', () => {
    const reply = buildRecurringPaymentConfirmedReply('Netflix', 5000, 'ARS')
    expect(reply).toContain('$5.000')
    expect(reply).toContain('"Netflix"')
    expect(reply).toContain('lo sumé a tus Gastos')
  })

  it('buildRecurringPaymentNotFoundReply avisa si no hay servicio con ese nombre', () => {
    expect(buildRecurringPaymentNotFoundReply('Netflix')).toContain('Netflix')
    expect(buildRecurringPaymentNotFoundReply('Netflix')).toContain('No encontré')
  })
})

describe('buildMainReplyKeyboard', () => {
  it('incluye los 4 botones rápidos del teclado persistente', () => {
    const keyboard = buildMainReplyKeyboard()
    expect(keyboard.reply_keyboard).toEqual([
      ['💳 Billeteras'],
      ['📅 Vencimientos'],
      ['🎯 Safe-to-Spend'],
      ['📊 Mi Score'],
    ])
    expect(keyboard.resize_keyboard).toBe(true)
    expect(keyboard.one_time_keyboard).toBe(false)
  })
})

describe('buildSetMyCommandsPayload', () => {
  it('registra los comandos nativos del menú', () => {
    const payload = buildSetMyCommandsPayload()
    const commands = payload.commands.map((c) => c.command)
    expect(commands).toContain('ayuda')
    expect(commands).toContain('billeteras')
    expect(commands).toContain('vencimientos')
    expect(commands).toContain('safetospend')
    expect(commands).toContain('score')
    expect(commands).toContain('resumen')
    expect(commands).toContain('gastos')
  })

  it('cada comando trae una descripción', () => {
    for (const command of buildSetMyCommandsPayload().commands) {
      expect(command.description.length).toBeGreaterThan(0)
    }
  })
})

describe('buildDebtsPayload', () => {
  it('arma un botón inline "Marcar Pagada" por deuda "debo" pendiente', () => {
    const payload = buildDebtsPayload([
      { id: 'debt-1', description: 'Deuda con Juan', counterpartyName: 'Juan', debtType: 'debo', totalAmount: 5000, remainingAmount: 5000, currency: 'ARS' },
      { id: 'debt-2', description: 'Deuda con Pedro', counterpartyName: 'Pedro', debtType: 'me_deben', totalAmount: 3000, remainingAmount: 1000, currency: 'ARS' },
    ])
    expect(payload.text).toContain('le debés $5.000')
    expect(payload.replyMarkup).not.toBeNull()
    const markup = payload.replyMarkup as InlineKeyboardMarkup
    expect(markup.inline_keyboard[0][0]).toEqual({ text: '✅ Marcar Pagada', callback_data: 'pay_debt:debt-1' })
    expect(markup.inline_keyboard).toHaveLength(1)
  })

  it('no manda botones si no hay deudas "debo" pendientes', () => {
    const payload = buildDebtsPayload([
      { id: 'debt-1', description: 'Deuda con Pedro', counterpartyName: 'Pedro', debtType: 'me_deben', totalAmount: 3000, remainingAmount: 3000, currency: 'ARS' },
    ])
    expect(payload.replyMarkup).toBeNull()
  })

  it('no arma botón para una deuda "debo" ya saldada', () => {
    const payload = buildDebtsPayload([
      { id: 'debt-1', description: 'Deuda con Juan', counterpartyName: 'Juan', debtType: 'debo', totalAmount: 5000, remainingAmount: 0, currency: 'ARS' },
    ])
    expect(payload.replyMarkup).toBeNull()
  })
})

describe('buildCuotasPayload', () => {
  it('arma un botón inline por compra con cuotas impagas', () => {
    const payload = buildCuotasPayload([
      { id: 'purchase-1', description: 'Heladera', totalAmount: 200000, installmentsCount: 12, paidCount: 3, monthlyAmount: 16666.67 },
    ])
    expect(payload.text).toContain('Heladera')
    expect(payload.replyMarkup).not.toBeNull()
    const markup = payload.replyMarkup as InlineKeyboardMarkup
    expect(markup.inline_keyboard[0][0]).toEqual({ text: '✅ Marcar Pagada', callback_data: 'pay_installment:purchase-1' })
  })

  it('no manda botones si todas las cuotas están pagadas', () => {
    const payload = buildCuotasPayload([
      { id: 'purchase-1', description: 'Heladera', totalAmount: 200000, installmentsCount: 12, paidCount: 12, monthlyAmount: 16666.67 },
    ])
    expect(payload.replyMarkup).toBeNull()
  })
})

describe('buildVencimientosPayload', () => {
  const today = new Date(2026, 7, 1)

  it('arma botones para cuotas y deudas pagables con su callback', () => {
    const items = computeUpcomingDueItems({
      recurring: [],
      installments: [
        { id: 'p1', description: 'Heladera', totalAmount: 120000, installmentsCount: 12, firstInstallmentDate: '2026-07-15', paidInstallmentNumbers: [] },
      ],
      debts: [
        { id: 'd1', description: 'Préstamo', remainingAmount: 30000, currency: 'ARS', dueDate: '2026-08-25', debtType: 'debo' },
        { id: 'd2', description: 'Crédito que me deben', remainingAmount: 99999, currency: 'ARS', dueDate: '2026-08-10', debtType: 'me_deben' },
      ],
      today,
    })
    const payload = buildVencimientosPayload(items)
    expect(payload.text).toContain('cuota 2/12')
    expect(payload.replyMarkup).not.toBeNull()
    const data = (payload.replyMarkup as InlineKeyboardMarkup).inline_keyboard.map((row) => row[0].callback_data)
    expect(data).toContain('pay_installment:p1:2')
    expect(data).toContain('pay_debt:d1')
  })
})

describe('buildExpenseCategorySlices', () => {
  it('agrupa los gastos del mes por categoría y los ordena de mayor a menor', () => {
    const slices = buildExpenseCategorySlices([
      { type: 'expense', amountArs: 1000, categoryName: 'Comida' },
      { type: 'expense', amountArs: 2000, categoryName: 'Comida' },
      { type: 'expense', amountArs: 500, categoryName: null },
      { type: 'income', amountArs: 99999, categoryName: 'Sueldo' },
    ])
    expect(slices).toEqual([
      { label: 'Comida', value: 3000 },
      { label: 'Sin categoría', value: 500 },
    ])
  })

  it('ignora ingresos y devuelve lista vacía sin gastos', () => {
    expect(buildExpenseCategorySlices([{ type: 'income', amountArs: 1000, categoryName: 'Sueldo' }])).toEqual([])
  })
})

describe('buildQuickChartPieUrl', () => {
  it('genera una URL de QuickChart con el config del gráfico codificado', () => {
    const url = buildQuickChartPieUrl([
      { label: 'Comida', value: 3000 },
      { label: 'Transporte', value: 500 },
    ])
    expect(url).toContain('https://quickchart.io/chart?c=')
    expect(url).toContain('doughnut')
    expect(url).toContain(encodeURIComponent('Comida'))
  })

  it('decodifica el config y respeta los montos', () => {
    const url = buildQuickChartPieUrl([{ label: 'Comida', value: 3000 }])
    const decoded = decodeURIComponent(url.replace('https://quickchart.io/chart?c=', '').split('&')[0])
    expect(JSON.parse(decoded).data.datasets[0].data).toEqual([3000])
  })
})

describe('buildResumenCaption', () => {
  it('arma el desglose por categoría con el total del mes y el porcentaje', () => {
    const caption = buildResumenCaption([{ label: 'Comida', value: 3000 }], 5000, 20000)
    expect(caption).toContain('Tus gastos de $5.000')
    expect(caption).toContain('Comida: $3.000')
    expect(caption).toContain('25%')
    expect(caption).toContain('$20.000')
  })

  it('sugiere cargar el ingreso si no hay', () => {
    const caption = buildResumenCaption([{ label: 'Comida', value: 3000 }], 5000, 0)
    expect(caption).toContain('Cargá tu ingreso mensual')
  })
})
