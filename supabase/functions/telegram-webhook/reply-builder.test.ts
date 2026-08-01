import { describe, it, expect } from 'vitest'
import {
  buildBilleterasReply,
  buildConsejosReply,
  buildCuotasReply,
  buildDebtConfirmedReply,
  buildDebtPaymentConfirmedReply,
  buildDebtPaymentNotFoundReply,
  buildDebtsReply,
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
  buildMetasReply,
  buildNotLinkedReply,
  buildRecurringConfirmedReply,
  buildRecurringPaymentConfirmedReply,
  buildRecurringPaymentNotFoundReply,
  buildSafeToSpendReply,
  buildSaldoReply,
  buildSaveErrorReply,
  buildSavingsGoalConfirmedReply,
  buildScoreReply,
  buildUnknownCommandReply,
  buildUnrecognizedReply,
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

  it('buildInstallmentConfirmedReply muestra monto y cuota', () => {
    expect(buildInstallmentConfirmedReply('Heladera', 200000, 12)).toContain('12 cuotas de $16.666,67')
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
