import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpeedDialFab from '../SpeedDialFab'
import { CategoriesProvider } from '@/context/CategoriesContext'
import { WalletsProvider } from '@/context/WalletsContext'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))

function renderFab(onManualEntry = vi.fn()) {
  return render(
    <AppProviders>
      <CategoriesProvider>
        <WalletsProvider>
          <SpeedDialFab onManualEntry={onManualEntry} />
        </WalletsProvider>
      </CategoriesProvider>
    </AppProviders>
  )
}

describe('SpeedDialFab', () => {
  beforeEach(() => {
    Object.assign(supabaseMock, createSupabaseMock())
  })

  it('el menú desplegable arranca cerrado (las opciones están ocultas con aria-hidden)', () => {
    renderFab()
    expect(screen.getByTitle('Cargar por Voz')).toHaveAttribute('aria-hidden', 'true')
  })

  it('al tocar el botón central se despliegan las 4 opciones', async () => {
    renderFab()
    await userEvent.click(screen.getByTitle('Agregar'))

    expect(screen.getByTitle('Carga Manual')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByTitle('Calculadora ARS/USD')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByTitle('Escanear QR')).toHaveAttribute('aria-hidden', 'false')
    expect(screen.getByTitle('Cargar por Voz')).toHaveAttribute('aria-hidden', 'false')
  })

  it('elegir "Carga Manual" llama a onManualEntry y cierra el menú', async () => {
    const onManualEntry = vi.fn()
    renderFab(onManualEntry)

    await userEvent.click(screen.getByTitle('Agregar'))
    await userEvent.click(screen.getByTitle('Carga Manual'))

    expect(onManualEntry).toHaveBeenCalledTimes(1)
    expect(screen.getByTitle('Cargar por Voz')).toHaveAttribute('aria-hidden', 'true')
  })

  it('elegir "Calculadora ARS/USD" abre el modal de la calculadora', async () => {
    renderFab()
    await userEvent.click(screen.getByTitle('Agregar'))
    await userEvent.click(screen.getByTitle('Calculadora ARS/USD'))

    expect(screen.getByText('Calculadora ARS / USD Blue')).toBeInTheDocument()
  })
})
