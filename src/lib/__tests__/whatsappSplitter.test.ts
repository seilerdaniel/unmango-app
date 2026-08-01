import { describe, it, expect } from 'vitest'
import { generateWhatsAppSplitText, formatArs } from '../whatsappSplitter'

describe('generateWhatsAppSplitText', () => {
  it('división exacta: calcula el monto por persona y arma el mensaje completo', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena en Coto',
      totalAmount: 100000,
      participantsCount: 4,
    })

    expect(result.perPersonAmount).toBe(25000)
    expect(result.exactDivision).toBe(true)
    expect(result.message).toContain('"Cena en Coto"')
    expect(result.message).toContain(`Total: ${formatArs(100000)}`)
    expect(result.message).toContain(`Entre 4: ${formatArs(25000)} cada uno`)
  })

  it('división inexacta: redondea a 2 decimales y lo aclara en el mensaje', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 100000,
      participantsCount: 3,
    })

    expect(result.perPersonAmount).toBe(33333.33)
    expect(result.exactDivision).toBe(false)
    expect(result.message).toContain('Montos redondeados a 2 decimales')
    expect(result.message).toContain(formatArs(33333.33))
  })

  it('división inexacta de centavos: 1000 entre 3 da 333,33 por persona', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 1000,
      participantsCount: 3,
    })

    expect(result.perPersonAmount).toBe(333.33)
    expect(result.exactDivision).toBe(false)
  })

  it('incluye los datos de transferencia cuando se pasan', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 20000,
      participantsCount: 2,
      paymentDetails: 'juan.perez',
    })

    expect(result.message).toContain('Datos para transferir: juan.perez')
  })

  it('omite la línea de datos de transferencia si no se pasa ninguna', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 20000,
      participantsCount: 2,
    })

    expect(result.message).not.toContain('Datos para transferir')
  })

  it('el mensaje es texto plano con emojis', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 20000,
      participantsCount: 2,
    })

    expect(result.message).toContain('💰')
    expect(result.message).toContain('👥')
    expect(result.message).toContain('📲')
  })

  it('arma la URL genérica de wa.me y codifica el mensaje', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 20000,
      participantsCount: 2,
    })

    expect(result.url).toContain('https://wa.me/?text=')
    expect(result.url).toContain(encodeURIComponent(result.message))
  })

  it('arma la URL con teléfono cuando se pasa uno (limpia caracteres no numéricos)', () => {
    const result = generateWhatsAppSplitText({
      title: 'Cena',
      totalAmount: 20000,
      participantsCount: 2,
      phone: '+54 9 11-1234-5678',
    })

    expect(result.url).toContain('https://wa.me/5491112345678?text=')
  })

  it('participantes 0 o negativos se tratan como 1 (todo el gasto a una persona)', () => {
    const single = generateWhatsAppSplitText({ title: 'Cena', totalAmount: 5000, participantsCount: 0 })
    expect(single.perPersonAmount).toBe(5000)
    expect(single.message).toContain('Entre 1:')

    const negative = generateWhatsAppSplitText({ title: 'Cena', totalAmount: 5000, participantsCount: -3 })
    expect(negative.perPersonAmount).toBe(5000)
  })

  it('título vacío usa un default amigable', () => {
    const result = generateWhatsAppSplitText({ title: '   ', totalAmount: 5000, participantsCount: 2 })
    expect(result.message).toContain('"gasto compartido"')
  })
})
