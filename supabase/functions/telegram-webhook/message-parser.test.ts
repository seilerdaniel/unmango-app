import { describe, it, expect } from 'vitest'
import { parseTelegramMessage } from './message-parser'

describe('parseTelegramMessage', () => {
  it('reconoce un código de vinculación con /start', () => {
    const result = parseTelegramMessage('/start 483920')
    expect(result).toEqual({ kind: 'link_code', code: '483920' })
  })

  it('reconoce un código de vinculación solo (sin /start)', () => {
    const result = parseTelegramMessage('483920')
    expect(result).toEqual({ kind: 'link_code', code: '483920' })
  })

  it('parsea un gasto simple: "Gasto 4500 café"', () => {
    const result = parseTelegramMessage('Gasto 4500 café')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'café' })
  })

  it('parsea un gasto sin la palabra "Gasto" adelante', () => {
    const result = parseTelegramMessage('4500 café')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'café' })
  })

  it('usa una descripción genérica si no queda texto después del monto', () => {
    const result = parseTelegramMessage('Gasto 4500')
    expect(result).toEqual({ kind: 'expense', amount: 4500, description: 'Gasto por Telegram' })
  })

  it('parsea montos en formato argentino', () => {
    const result = parseTelegramMessage('Gasto 1.500,50 supermercado')
    expect(result.kind).toBe('expense')
    expect((result as { amount: number }).amount).toBeCloseTo(1500.5)
  })

  it('devuelve unrecognized si no hay ningún número ni código', () => {
    const result = parseTelegramMessage('hola como estas')
    expect(result).toEqual({ kind: 'unrecognized' })
  })

  it('devuelve unrecognized para un monto de 0 o negativo', () => {
    expect(parseTelegramMessage('Gasto 0 nada').kind).toBe('unrecognized')
  })

  it('reconoce el comando /saldo', () => {
    expect(parseTelegramMessage('/saldo')).toEqual({ kind: 'command', command: 'saldo' })
  })

  it('reconoce el comando /gastado', () => {
    expect(parseTelegramMessage('/gastado')).toEqual({ kind: 'command', command: 'gastado' })
  })

  it('reconoce el comando /safetospend', () => {
    expect(parseTelegramMessage('/safetospend')).toEqual({ kind: 'command', command: 'safetospend' })
  })

  it('reconoce /ayuda y /help como ayuda', () => {
    expect(parseTelegramMessage('/ayuda')).toEqual({ kind: 'command', command: 'ayuda' })
    expect(parseTelegramMessage('/help')).toEqual({ kind: 'command', command: 'ayuda' })
  })

  it('reconoce /start sin código como comando (no como link)', () => {
    expect(parseTelegramMessage('/start')).toEqual({ kind: 'command', command: 'start' })
  })

  it('trata un comando conocido con texto extra como comando', () => {
    expect(parseTelegramMessage('/saldo 5000')).toEqual({ kind: 'command', command: 'saldo' })
  })

  it('devuelve unknown_command para un comando no conocido', () => {
    expect(parseTelegramMessage('/hola')).toEqual({ kind: 'unknown_command', command: 'hola' })
    expect(parseTelegramMessage('/hola 5000')).toEqual({ kind: 'unknown_command', command: 'hola' })
  })
})

describe('parseTelegramMessage: deudas', () => {
  it('"Debo 5000 a Juan" registra una deuda debo', () => {
    expect(parseTelegramMessage('Debo 5000 a Juan')).toEqual({
      kind: 'debt',
      debtType: 'debo',
      amount: 5000,
      counterpartyName: 'Juan',
    })
  })

  it('"Le debo 1500 a María" registra una deuda debo', () => {
    expect(parseTelegramMessage('Le debo 1500 a María')).toEqual({
      kind: 'debt',
      debtType: 'debo',
      amount: 1500,
      counterpartyName: 'María',
    })
  })

  it('"Me debe 3000 Pedro" registra una deuda me_deben', () => {
    expect(parseTelegramMessage('Me debe 3000 Pedro')).toEqual({
      kind: 'debt',
      debtType: 'me_deben',
      amount: 3000,
      counterpartyName: 'Pedro',
    })
  })

  it('"Me debe 3000" sin nombre usa "la otra persona"', () => {
    const result = parseTelegramMessage('Me debe 3000')
    expect(result).toEqual({ kind: 'debt', debtType: 'me_deben', amount: 3000, counterpartyName: 'la otra persona' })
  })
})

describe('parseTelegramMessage: compras en cuotas', () => {
  it('"Heladera 200000 en 12 cuotas" separa descripción y monto', () => {
    expect(parseTelegramMessage('Heladera 200000 en 12 cuotas')).toEqual({
      kind: 'installment',
      description: 'Heladera',
      totalAmount: 200000,
      installmentsCount: 12,
    })
  })

  it('"Compra 200000 12 cuotas" sin descripción usa un nombre genérico', () => {
    expect(parseTelegramMessage('Compra 200000 12 cuotas')).toEqual({
      kind: 'installment',
      description: 'Compra en cuotas',
      totalAmount: 200000,
      installmentsCount: 12,
    })
  })

  it('"Compré 200000 en 12 cuotas" funciona con el verbo conjugado', () => {
    expect(parseTelegramMessage('Compré 200000 en 12 cuotas')).toEqual({
      kind: 'installment',
      description: 'Compra en cuotas',
      totalAmount: 200000,
      installmentsCount: 12,
    })
  })
})

describe('parseTelegramMessage: suscripciones y gastos fijos', () => {
  it('"Suscripción 5000 Netflix" es una suscripción', () => {
    expect(parseTelegramMessage('Suscripción 5000 Netflix')).toEqual({
      kind: 'recurring',
      description: 'Netflix',
      amount: 5000,
      expenseKind: 'subscription',
    })
  })

  it('"Alquiler 20000" es un gasto fijo de tipo utility_rent', () => {
    expect(parseTelegramMessage('Alquiler 20000')).toEqual({
      kind: 'recurring',
      description: 'Gasto fijo por Telegram',
      amount: 20000,
      expenseKind: 'utility_rent',
    })
  })

  it('"Servicio 3000 luz" es un gasto fijo', () => {
    expect(parseTelegramMessage('Servicio 3000 luz')).toEqual({
      kind: 'recurring',
      description: 'luz',
      amount: 3000,
      expenseKind: 'utility_rent',
    })
  })

  it('"Cable 3000 mensual" es una suscripción', () => {
    expect(parseTelegramMessage('Cable 3000 mensual')).toEqual({
      kind: 'recurring',
      description: 'Cable',
      amount: 3000,
      expenseKind: 'subscription',
    })
  })

  it('"Fijo 2000 cable" es un gasto fijo', () => {
    expect(parseTelegramMessage('Fijo 2000 cable')).toEqual({
      kind: 'recurring',
      description: 'cable',
      amount: 2000,
      expenseKind: 'utility_rent',
    })
  })
})

describe('parseTelegramMessage: metas de ahorro', () => {
  it('"Meta Vacaciones 200000" separa nombre y monto', () => {
    expect(parseTelegramMessage('Meta Vacaciones 200000')).toEqual({
      kind: 'savings_goal',
      name: 'Vacaciones',
      targetAmount: 200000,
    })
  })

  it('"Meta 200000 para Vacaciones" usa la palabra "para"', () => {
    expect(parseTelegramMessage('Meta 200000 para Vacaciones')).toEqual({
      kind: 'savings_goal',
      name: 'Vacaciones',
      targetAmount: 200000,
    })
  })

  it('"Ahorrar 50000 para viaje" usa la palabra "ahorrar"', () => {
    expect(parseTelegramMessage('Ahorrar 50000 para viaje')).toEqual({
      kind: 'savings_goal',
      name: 'viaje',
      targetAmount: 50000,
    })
  })
})

describe('parseTelegramMessage: comandos nuevos', () => {
  it('reconoce /score', () => {
    expect(parseTelegramMessage('/score')).toEqual({ kind: 'command', command: 'score' })
  })

  it('reconoce /deudas, /cuotas, /metas, /fijos, /consejos y /hogar', () => {
    expect(parseTelegramMessage('/deudas')).toEqual({ kind: 'command', command: 'deudas' })
    expect(parseTelegramMessage('/cuotas')).toEqual({ kind: 'command', command: 'cuotas' })
    expect(parseTelegramMessage('/metas')).toEqual({ kind: 'command', command: 'metas' })
    expect(parseTelegramMessage('/fijos')).toEqual({ kind: 'command', command: 'fijos' })
    expect(parseTelegramMessage('/consejos')).toEqual({ kind: 'command', command: 'consejos' })
    expect(parseTelegramMessage('/hogar')).toEqual({ kind: 'command', command: 'hogar' })
  })

  it('reconoce /billeteras y /vencimientos', () => {
    expect(parseTelegramMessage('/billeteras')).toEqual({ kind: 'command', command: 'billeteras' })
    expect(parseTelegramMessage('/vencimientos')).toEqual({ kind: 'command', command: 'vencimientos' })
  })
})

describe('parseTelegramMessage: el gasto común sigue intacto', () => {
  it('"Gasto 4500 café" sigue siendo un gasto', () => {
    expect(parseTelegramMessage('Gasto 4500 café')).toEqual({ kind: 'expense', amount: 4500, description: 'café' })
  })

  it('"Gasto 20000 alquiler" no se confunde con un gasto fijo', () => {
    expect(parseTelegramMessage('Gasto 20000 alquiler')).toEqual({ kind: 'expense', amount: 20000, description: 'alquiler' })
  })
})
