import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InstallmentSimulator, { type ConvertToInstallmentPlan } from '../tools/InstallmentSimulator'
import { PrivacyProvider } from '@/context/PrivacyContext'

function renderSimulator(onConvert: (plan: ConvertToInstallmentPlan) => void) {
  return render(
    <PrivacyProvider>
      <InstallmentSimulator onConvertToInstallmentPurchase={onConvert} />
    </PrivacyProvider>
  )
}

async function fillBaseForm() {
  await userEvent.type(screen.getByLabelText('Precio contado'), '120000')
  await userEvent.type(screen.getByLabelText('Inflación mensual %'), '5')
}

describe('InstallmentSimulator', () => {
  it('abre el modal desde el botón', async () => {
    renderSimulator(() => {})
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /simulador anti-inflación/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar simulador' })).toBeInTheDocument()
  })

  it('sin datos cargados no calcula opciones', async () => {
    renderSimulator(() => {})
    await userEvent.click(screen.getByRole('button', { name: /simulador anti-inflación/i }))

    expect(screen.queryByRole('button', { name: /convertir en compra en cuotas/i })).not.toBeInTheDocument()
  })

  it('convierte la mejor opción en compra en cuotas con los datos precargados', async () => {
    const onConvert = vi.fn()
    renderSimulator(onConvert)

    await userEvent.click(screen.getByRole('button', { name: /simulador anti-inflación/i }))
    await fillBaseForm()

    // Dos opciones por defecto (3 y 6 cuotas sin interés); la de 6 es la
    // mejor y, por el sort por ahorro, queda primera.
    const convertButtons = await screen.findAllByRole('button', { name: /convertir en compra en cuotas/i })
    expect(convertButtons).toHaveLength(2)

    await userEvent.click(convertButtons[0])

    expect(onConvert).toHaveBeenCalledTimes(1)
    expect(onConvert).toHaveBeenCalledWith({
      description: 'Compra en cuotas',
      totalAmount: 120000,
      installmentsCount: 6,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('precarga la descripción escrita por el usuario', async () => {
    const onConvert = vi.fn()
    renderSimulator(onConvert)

    await userEvent.click(screen.getByRole('button', { name: /simulador anti-inflación/i }))
    await userEvent.type(screen.getByLabelText('Nombre del producto (opcional)'), 'Heladera')
    await fillBaseForm()

    const convertButtons = await screen.findAllByRole('button', { name: /convertir en compra en cuotas/i })
    await userEvent.click(convertButtons[0])

    expect(onConvert).toHaveBeenCalledWith(expect.objectContaining({ description: 'Heladera' }))
  })

  it('permite quitar y agregar opciones de financiación', async () => {
    renderSimulator(() => {})
    await userEvent.click(screen.getByRole('button', { name: /simulador anti-inflación/i }))

    expect(screen.getAllByRole('button', { name: 'Quitar opción' })).toHaveLength(2)

    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar opción' })[0])
    expect(screen.getAllByRole('button', { name: 'Quitar opción' })).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: /agregar opción/i }))
    expect(screen.getAllByRole('button', { name: 'Quitar opción' })).toHaveLength(2)
  })
})
