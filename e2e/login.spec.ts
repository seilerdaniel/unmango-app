import { test, expect } from '@playwright/test'

// Estos tests no pegan contra Supabase real: solo verifican que la
// pantalla de login se renderiza y valida correctamente. Sirven como
// smoke test rápido que no depende de tener un proyecto de Supabase
// configurado.

test.describe('Pantalla de login', () => {
  test('muestra el formulario de inicio de sesión por defecto', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'UnMango' })).toBeVisible()
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible()
    await expect(page.getByLabel('Correo Electrónico')).toBeVisible()
    await expect(page.getByLabel('Contraseña')).toBeVisible()
  })

  test('permite alternar a la pantalla de registro', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /no tenés cuenta/i }).click()

    await expect(page.getByRole('button', { name: /registrarme/i })).toBeVisible()
  })

  test('no deja enviar el formulario sin email ni contraseña', async ({ page }) => {
    await page.goto('/login')

    const emailInput = page.getByLabel('Correo Electrónico')
    await expect(emailInput).toHaveAttribute('required', '')

    const passwordInput = page.getByLabel('Contraseña')
    await expect(passwordInput).toHaveAttribute('required', '')
  })
})
