import { FinancialHealthResult } from './financialHealthScore'

export type AdviceSeverity = 'success' | 'warning' | 'danger' | 'info'

export interface AdviceAction {
  label: string
  /** Si la acción es abrir Configuración (ej. crear categorías), no hace falta pestaña — se ignora sectionId en ese caso. */
  openSettings?: boolean
  tab?: 'inicio' | 'analisis' | 'planes' | 'historial'
  /** id del contenedor al que hacer scroll dentro de esa pestaña, si hace falta. */
  sectionId?: string
}

export interface AdviceItem {
  id: string
  severity: AdviceSeverity
  message: string
  action?: AdviceAction
}

export interface AdviceInputs {
  healthScore: FinancialHealthResult
  hasSubscriptionPriceIncrease: boolean
  /** Cuánto podés gastar hoy sin comprometer tus gastos fijos (Límite Seguro de Gasto Diario). null si no hay datos suficientes para calcularlo. */
  safeToSpendToday: number | null
  /** Nombres de categorías cuyo presupuesto ya se superó este mes. */
  exceededBudgetCategoryNames: string[]
  /** true si hay alguna deuda activa ("debo") con interés > 0. */
  hasHighInterestDebt: boolean
  /** Descripción de una compra en cuotas cuya cuota mensual pesa mucho sobre el ingreso, o null si ninguna. */
  largeInstallmentDescription: string | null
  /** Días de racha sin gastos que se cortaron hoy, o null si no aplica. */
  brokenStreakDays: number | null
  /** Nombres de metas de ahorro que siguen en $0 después de bastante tiempo creadas. */
  stalledGoalNames: string[]
  /** true si el usuario todavía no creó ninguna categoría. */
  hasNoCategories: boolean
  /** true si hay gastos este mes pero ningún ingreso registrado. */
  hasExpensesButNoIncome: boolean
  /** Días desde el gasto de hogar más viejo sin saldar, o null si no aplica (sin hogar vinculado, o balance en 0). */
  householdUnsettledDays: number | null
}

/**
 * Motor de consejos basado en reglas (no IA) sobre los mismos 4
 * pilares del Un Mango Score, más un par de señales extra (aumento de
 * suscripciones, límite de gasto diario). Cada pilar solo genera un
 * consejo si está por debajo/encima de ciertos umbrales — así no se
 * satura con 4 consejos genéricos cuando en realidad todo está bien.
 * Función pura, separada de dónde salen los datos, para poder
 * testearla sin tocar la base.
 */
export function generateFinancialAdvice(inputs: AdviceInputs): AdviceItem[] {
  const { healthScore, hasSubscriptionPriceIncrease, safeToSpendToday, exceededBudgetCategoryNames, hasHighInterestDebt, largeInstallmentDescription, brokenStreakDays, stalledGoalNames, hasNoCategories, hasExpensesButNoIncome, householdUnsettledDays } = inputs
  const advice: AdviceItem[] = []

  const { savings, debt, emergencyFund, antExpenses } = healthScore.pillars

  if (savings.score < 30) {
    advice.push({
      id: 'savings-low',
      severity: 'danger',
      message: 'Estás gastando casi todo lo que ganás (o más). Intentá guardar aunque sea un 5-10% este mes.',
      action: { label: 'Crear una Meta de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' },
    })
  } else if (savings.score < 60) {
    advice.push({
      id: 'savings-mid',
      severity: 'warning',
      message: 'Tu margen de ahorro es bajo. Revisá si hay algún gasto que puedas recortar para guardar un poco más.',
      action: { label: 'Ver Metas de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' },
    })
  } else if (savings.score >= 80) {
    advice.push({
      id: 'savings-high',
      severity: 'success',
      message: 'Estás ahorrando una parte importante de tu ingreso — vas bien.',
    })
  }

  if (debt.score < 30) {
    advice.push({
      id: 'debt-low',
      severity: 'danger',
      message: 'Tus cuotas y gastos fijos comprometidos se están comiendo una parte muy grande de tu ingreso. Pensalo dos veces antes de sumar una cuota más.',
      action: { label: 'Ver Pagos Recurrentes', tab: 'planes', sectionId: 'pagos-recurrentes' },
    })
  } else if (debt.score < 60) {
    advice.push({
      id: 'debt-mid',
      severity: 'warning',
      message: 'Tenés bastante comprometido en cuotas y gastos fijos. Andá con cuidado antes de agregar más compromisos mensuales.',
      action: { label: 'Ver Pagos Recurrentes', tab: 'planes', sectionId: 'pagos-recurrentes' },
    })
  }

  if (emergencyFund.score < 20) {
    advice.push({
      id: 'emergency-low',
      severity: 'danger',
      message: 'Prácticamente no tenés colchón de emergencia. Un imprevisto (rotura, salud) te puede complicar bastante ahora mismo.',
      action: { label: 'Crear un Fondo de Emergencia', tab: 'planes', sectionId: 'metas-ahorro' },
    })
  } else if (emergencyFund.score < 60) {
    advice.push({
      id: 'emergency-mid',
      severity: 'warning',
      message: 'Tu fondo de emergencia cubre menos de 3 meses de gastos. Si podés, sumá una Meta de Ahorro para ir agrandándolo.',
      action: { label: 'Ver Metas de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' },
    })
  } else if (emergencyFund.score >= 90) {
    advice.push({
      id: 'emergency-high',
      severity: 'success',
      message: 'Tenés un buen colchón de emergencia armado.',
    })
  }

  if (antExpenses.score < 40) {
    advice.push({
      id: 'ant-expenses-low',
      severity: 'warning',
      message: 'Los gastos chicos del día a día (cafés, kiosco, delivery) están pesando bastante en tu mes — revisalos en Análisis, capaz hay margen ahí.',
      action: { label: 'Ver detalle en Análisis', tab: 'analisis', sectionId: 'gastos-hormiga' },
    })
  }

  if (hasSubscriptionPriceIncrease) {
    advice.push({
      id: 'subscription-increase',
      severity: 'info',
      message: 'Alguna de tus suscripciones subió de precio este último tiempo — revisá en Planes si te sigue conviniendo.',
      action: { label: 'Ver Pagos Recurrentes', tab: 'planes', sectionId: 'pagos-recurrentes' },
    })
  }

  if (safeToSpendToday !== null && safeToSpendToday <= 0) {
    advice.push({
      id: 'safe-to-spend-zero',
      severity: 'danger',
      message: 'Con el ritmo actual, ya no te queda margen para gastar este mes sin tocar tus gastos fijos comprometidos.',
      action: { label: 'Ver en Inicio', tab: 'inicio', sectionId: 'safe-to-spend' },
    })
  }

  if (exceededBudgetCategoryNames.length > 0) {
    const names = exceededBudgetCategoryNames.slice(0, 2).join(' y ')
    const extra = exceededBudgetCategoryNames.length > 2 ? ` (y ${exceededBudgetCategoryNames.length - 2} más)` : ''
    advice.push({
      id: 'budget-exceeded',
      severity: 'warning',
      message: `Superaste el presupuesto de ${names}${extra} este mes.`,
      action: { label: 'Ver Presupuestos', tab: 'planes', sectionId: 'presupuestos' },
    })
  }

  if (hasHighInterestDebt) {
    advice.push({
      id: 'high-interest-debt',
      severity: 'warning',
      message: 'Tenés una deuda con interés — priorizarla antes que ahorrar suele convenir más (el interés que pagás normalmente es mayor a lo que rendiría guardar esa plata).',
      action: { label: 'Ver Deudas y Préstamos', tab: 'planes', sectionId: 'deudas-prestamos' },
    })
  }

  if (largeInstallmentDescription) {
    advice.push({
      id: 'large-installment',
      severity: 'warning',
      message: `La cuota de "${largeInstallmentDescription}" pesa bastante sobre tu ingreso mensual.`,
      action: { label: 'Ver Cuotas', tab: 'planes', sectionId: 'cuotas' },
    })
  }

  if (brokenStreakDays !== null && brokenStreakDays >= 3) {
    advice.push({
      id: 'streak-broken',
      severity: 'info',
      message: `Veías ${brokenStreakDays} días seguidos sin gastos y hoy se cortó — no pasa nada, a retomarla.`,
    })
  }

  if (stalledGoalNames.length > 0) {
    const names = stalledGoalNames.slice(0, 2).join(' y ')
    advice.push({
      id: 'stalled-goal',
      severity: 'info',
      message: `Tu meta "${names}" sigue en $0 desde hace bastante — ¿le sumamos algo este mes?`,
      action: { label: 'Ver Metas de Ahorro', tab: 'planes', sectionId: 'metas-ahorro' },
    })
  }

  if (hasNoCategories) {
    advice.push({
      id: 'no-categories',
      severity: 'info',
      message: 'Todavía no creaste ninguna categoría — con categorías vas a poder ver en qué se te va la plata, no solo cuánto gastás.',
      action: { label: 'Crear categorías sugeridas', openSettings: true },
    })
  }

  if (hasExpensesButNoIncome) {
    advice.push({
      id: 'no-income-registered',
      severity: 'info',
      message: 'Tenés gastos cargados este mes pero ningún ingreso — el Score y el límite de gasto diario van a ser menos precisos hasta que lo cargues.',
      action: { label: 'Cargar ingreso', tab: 'inicio', sectionId: 'transaction-form' },
    })
  }

  if (householdUnsettledDays !== null && householdUnsettledDays >= 30) {
    advice.push({
      id: 'household-unsettled',
      severity: 'info',
      message: `Tenés gastos de hogar sin saldar desde hace ${householdUnsettledDays} días — puede ser buen momento para arreglar cuentas.`,
      action: { label: 'Ver Gastos de Hogar', tab: 'planes', sectionId: 'gastos-hogar' },
    })
  }

  return advice
}
