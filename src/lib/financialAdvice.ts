import { FinancialHealthResult } from './financialHealthScore'

export type AdviceSeverity = 'success' | 'warning' | 'danger' | 'info'

export interface AdviceItem {
  id: string
  severity: AdviceSeverity
  message: string
}

export interface AdviceInputs {
  healthScore: FinancialHealthResult
  hasSubscriptionPriceIncrease: boolean
  /** Cuánto podés gastar hoy sin comprometer tus gastos fijos (Límite Seguro de Gasto Diario). null si no hay datos suficientes para calcularlo. */
  safeToSpendToday: number | null
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
  const { healthScore, hasSubscriptionPriceIncrease, safeToSpendToday } = inputs
  const advice: AdviceItem[] = []

  const { savings, debt, emergencyFund, antExpenses } = healthScore.pillars

  if (savings.score < 30) {
    advice.push({
      id: 'savings-low',
      severity: 'danger',
      message: 'Estás gastando casi todo lo que ganás (o más). Intentá guardar aunque sea un 5-10% este mes.',
    })
  } else if (savings.score < 60) {
    advice.push({
      id: 'savings-mid',
      severity: 'warning',
      message: 'Tu margen de ahorro es bajo. Revisá si hay algún gasto que puedas recortar para guardar un poco más.',
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
    })
  } else if (debt.score < 60) {
    advice.push({
      id: 'debt-mid',
      severity: 'warning',
      message: 'Tenés bastante comprometido en cuotas y gastos fijos. Andá con cuidado antes de agregar más compromisos mensuales.',
    })
  }

  if (emergencyFund.score < 20) {
    advice.push({
      id: 'emergency-low',
      severity: 'danger',
      message: 'Prácticamente no tenés colchón de emergencia. Un imprevisto (rotura, salud) te puede complicar bastante ahora mismo.',
    })
  } else if (emergencyFund.score < 60) {
    advice.push({
      id: 'emergency-mid',
      severity: 'warning',
      message: 'Tu fondo de emergencia cubre menos de 3 meses de gastos. Si podés, sumá una Meta de Ahorro para ir agrandándolo.',
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
    })
  }

  if (hasSubscriptionPriceIncrease) {
    advice.push({
      id: 'subscription-increase',
      severity: 'info',
      message: 'Alguna de tus suscripciones subió de precio este último tiempo — revisá en Planes si te sigue conviniendo.',
    })
  }

  if (safeToSpendToday !== null && safeToSpendToday <= 0) {
    advice.push({
      id: 'safe-to-spend-zero',
      severity: 'danger',
      message: 'Con el ritmo actual, ya no te queda margen para gastar este mes sin tocar tus gastos fijos comprometidos.',
    })
  }

  return advice
}
