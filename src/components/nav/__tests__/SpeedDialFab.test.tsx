import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpeedDialFab from '../SpeedDialFab'
import { CategoriesProvider } from '@/context/CategoriesContext'

function renderFab(onManualEntry = vi.fn()) {
  return render(
    <CategoriesProvider>
      <SpeedDialFab onManualEntry={onManualEntry} />
    </CategoriesProvider>
  )
}

describe('SpeedDialFab', () => {
  it('el menú desplegable arranca cerrado (no se ven las 4 opciones)', () => {
    renderFab()
    expect(screen.queryByTitle('Cargar por Voz')).not.toBeInTheDocument()
  })

  it('al tocar el botón central se despliegan las 4 opciones', async () => {
    renderFab()
    await userEvent.click(screen.getByTitle('Agregar'))

    expect(screen.getByTitle('Carga Manual')).toBeInTheDocument()
    expect(screen.getByTitle('Calculadora ARS/USD')).toBeInTheDocument()
    expect(screen.getByTitle('Escanear QR')).toBeInTheDocument()
    expect(screen.getByTitle('Cargar por Voz')).toBeInTheDocument()
  })

  it('elegir "Carga Manual" llama a onManualEntry y cierra el menú', async () => {
    const onManualEntry = vi.fn()
    renderFab(onManualEntry)

    await userEvent.click(screen.getByTitle('Agregar'))
    await userEvent.click(screen.getByTitle('Carga Manual'))

    expect(onManualEntry).toHaveBeenCalledTimes(1)
    expect(screen.queryByTitle('Cargar por Voz')).not.toBeInTheDocument()
  })

  it('elegir "Calculadora ARS/USD" abre el modal de la calculadora', async () => {
    renderFab()
    await userEvent.click(screen.getByTitle('Agregar'))
    await userEvent.click(screen.getByTitle('Calculadora ARS/USD'))

    expect(screen.getByText('Calculadora ARS / USD Blue')).toBeInTheDocument()
  })
})
