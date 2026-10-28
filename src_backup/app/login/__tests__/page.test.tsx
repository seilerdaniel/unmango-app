import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../page'
import { ToastProvider } from '@/context/ToastContext'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

beforeEach(() => {
  Object.assign(supabaseMock, createSupabaseMock())
})

function renderLogin() {
  return render(
    <ToastProvider>
      <LoginPage />
    </ToastProvider>
  )
}

describe('LoginPage', () => {
  it('muestra el formulario de inicio de sesión por defecto', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'UnMango' })).toBeInTheDocument()
    expect(screen.getByLabelText('Correo Electrónico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('muestra los botones de Google y Microsoft pero oculta Apple', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar con microsoft/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /apple/i })).not.toBeInTheDocument()
  })

  it('permite alternar a la pantalla de registro', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /no tenés cuenta/i }))
    expect(screen.getByRole('button', { name: /registrarme/i })).toBeInTheDocument()
  })

  it('inicia sesión con email y contraseña', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText('Correo Electrónico'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    await waitFor(() =>
      expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'secret',
      })
    )
  })

  it('llama a signInWithOAuth con el provider al tocar un botón social', async () => {
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /continuar con google/i }))
    await waitFor(() =>
      expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      )
    )

    await userEvent.click(screen.getByRole('button', { name: /continuar con microsoft/i }))
    await waitFor(() =>
      expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'azure' })
      )
    )
  })
})
