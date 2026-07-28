import { test, expect, Page } from '@playwright/test'

// -----------------------------------------------------------------------
// IMPORTANTE — leer antes de correr esto por primera vez
// -----------------------------------------------------------------------
// Este test no pudo ejecutarse en el sandbox de esta sesión: Playwright
// necesita descargar un navegador (Chromium) desde cdn.playwright.dev, un
// dominio fuera de la lista de red permitida acá. Quedó escrito y
// estructurado con cuidado, pero corré `npx playwright install` en tu
// máquina y validalo antes de confiar en él para CI.
//
// La idea: en vez de pegarle a un proyecto Supabase real (lo que haría el
// test frágil y dependiente de datos de prueba), interceptamos las
// llamadas HTTP que hace @supabase/supabase-js (auth, REST, RPC) con
// page.route() y les devolvemos respuestas fijas. Si en tu proyecto real
// las URLs no coinciden exactamente con estos patrones (por ejemplo si
// usás un dominio custom para Supabase), ajustá los glob de `page.route`.
// -----------------------------------------------------------------------

const FAKE_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
}

const FAKE_SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: FAKE_USER,
}

async function mockSupabaseBackend(page: Page) {
  // --- Auth ---
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({ json: FAKE_SESSION })
  )
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ json: FAKE_USER })
  )
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }))

  // --- Datos base: sin categorías, sin presupuestos, sin recurrentes ---
  await page.route('**/rest/v1/categories**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/budgets**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/recurring_expenses**', (route) => route.fulfill({ json: [] }))

  // --- Transacciones: arranca vacío, y después de crear una aparece en
  // la siguiente consulta (simulamos con una variable mutable). ---
  interface FakeTransaction {
    type: 'income' | 'expense'
    amount_ars: number
    [key: string]: unknown
  }

  let transactions: FakeTransaction[] = []

  await page.route('**/rest/v1/transactions**', async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      const body = route.request().postDataJSON()
      const inserted = Array.isArray(body) ? body[0] : body
      transactions = [
        {
          id: 'tx-e2e-1',
          ...inserted,
          created_at: new Date().toISOString(),
          categories: null,
        },
        ...transactions,
      ]
      return route.fulfill({ json: transactions })
    }
    if (method === 'DELETE') {
      transactions = []
      return route.fulfill({ json: [] })
    }
    return route.fulfill({ json: transactions })
  })

  await page.route('**/rest/v1/rpc/get_transaction_totals**', async (route) => {
    const totalExpense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount_ars), 0)
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + Number(t.amount_ars), 0)

    return route.fulfill({ json: [{ total_income: totalIncome, total_expense: totalExpense }] })
  })

  await page.route('**/rest/v1/rpc/get_monthly_category_spend**', (route) =>
    route.fulfill({ json: [] })
  )

  // Sesión ya guardada en localStorage para que la app arranque logueada
  // (evita tener que simular el submit del form de login por separado).
  await page.addInitScript((session) => {
    window.localStorage.setItem(
      'sb-placeholder-auth-token',
      JSON.stringify(session)
    )
  }, FAKE_SESSION)
}

test.describe('Flujo crítico: cargar un gasto y ver el balance', () => {
  test.skip(
    true,
    'Requiere navegador de Playwright instalado localmente (no disponible en este sandbox). Sacar este test.skip después de validarlo con `npx playwright install`.'
  )

  test('cargar un gasto actualiza el balance del dashboard', async ({ page }) => {
    await mockSupabaseBackend(page)
    await page.goto('/')

    await expect(page.getByText('UnMango')).toBeVisible()

    await page.getByPlaceholder('Ej: Supermercado, Alquiler...').fill('Supermercado')
    await page.getByPlaceholder('0.00').fill('5000')
    await page.getByRole('button', { name: 'Registrar Movimiento' }).click()

    await expect(page.getByText('Supermercado')).toBeVisible()
    // El balance (-5000, ya que arranca en 0) debería reflejar el gasto
    await expect(page.getByText(/5.000,00/)).toBeVisible()
  })
})
