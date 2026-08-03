import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PricingModal from '../PricingModal'
import { AppProviders } from '@/test-utils/AppProviders'
import { createSupabaseMock } from '@/test-utils/supabaseMock'
import type { createSupabaseMock as CreateSupabaseMock } from '@/test-utils/supabaseMock'

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {} as ReturnType<typeof CreateSupabaseMock>,
}))

const { redirectToCheckout } = vi.hoisted(() => ({ redirectToCheckout: vi.fn() }))

vi.mock('@/lib/supabaseClient', () => ({ supabase: supabaseMock }))
vi.mock('@/lib/checkout', () => ({ redirectToCheckout }))

const INIT_POINT = 'https://checkout.mercadopago.com.ar/PAY_ABC'

function renderModal(overrides: Partial<React.ComponentProps<typeof PricingModal>> = {}) {
  return render(
    <AppProviders>
      <PricingModal isOpen currentPlan="free" onClose={() => {}} {...overrides} />
    </AppProviders>
  )
}

/** Espera a que UserProvider resuelva la sesión (el mock devuelve user-1). */
async function waitForSession() {
  await waitFor(() => expect(supabaseMock._fromCalls).toContain('subscriptions'))
}

beforeEach(() => {
  // Todos los tests renderizan con AppProviders (UserProvider + ...), que
  // llaman al mock de supabase apenas monta — sin asignar un mock válido
  // `supabase.auth` queda undefined y explota. Por defecto, invoke() no
  // devuelve nada; cada test que lo necesite lo sobrescribe con
  // Object.assign.
  Object.assign(supabaseMock, createSupabaseMock())
  redirectToCheckout.mockClear()
})

describe('PricingModal', () => {
  it('no renderiza nada cuando está cerrado', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('heading', { name: /Planes UnMango/i })).not.toBeInTheDocument()
  })

  it('muestra las tres tarjetas de plan', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /Planes UnMango/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FREE' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PRO' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'HOGAR' })).toBeInTheDocument()
    expect(screen.getByText('$9.99')).toBeInTheDocument()
    expect(screen.getByText('$29.99')).toBeInTheDocument()
  })

  it('marca la tarjeta PRO como la popular', () => {
    renderModal()
    expect(screen.getByText('Popular')).toBeInTheDocument()
  })

  it('marca el plan actual con el badge "Actual"', () => {
    renderModal({ currentPlan: 'pro' })
    expect(screen.getAllByText('Actual')).toHaveLength(1)
  })

  it('el botón del plan actual está deshabilitado', () => {
    renderModal({ currentPlan: 'free' })
    expect(screen.getByRole('button', { name: /tu plan actual/i })).toBeDisabled()
  })

  it('cierra con el botón X', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    await userEvent.click(screen.getByTitle('Cerrar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('suscribirse a PRO invoca mercadopago-checkout y redirige al init_point', async () => {
    const invokeMock = vi.fn(async () => ({ data: { init_point: INIT_POINT }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /suscribirme con mercado pago/i })[0])

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('mercadopago-checkout', {
        body: { plan: 'pro', userId: 'user-1' },
      })
    )
    await waitFor(() => expect(redirectToCheckout).toHaveBeenCalledWith(INIT_POINT))
  })

  it('suscribirse a HOGAR invoca con el plan hogar', async () => {
    const invokeMock = vi.fn(async () => ({ data: { init_point: INIT_POINT }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /suscribirme con mercado pago/i })[1])

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('mercadopago-checkout', {
        body: { plan: 'hogar', userId: 'user-1' },
      })
    )
  })

  it('muestra estado de carga mientras se procesa el checkout', async () => {
    let resolveInvoke!: (value: { data: unknown; error: unknown }) => void
    const invokeMock = vi.fn(
      () => new Promise<{ data: unknown; error: unknown }>((resolve) => (resolveInvoke = resolve))
    )
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /suscribirme con mercado pago/i })[0])

    expect(await screen.findByText(/procesando/i)).toBeInTheDocument()

    resolveInvoke({ data: { init_point: INIT_POINT }, error: null })
    await waitFor(() => expect(redirectToCheckout).toHaveBeenCalledWith(INIT_POINT))
  })

  it('muestra un error sin redirigir si la Edge Function falla', async () => {
    const invokeMock = vi.fn(async () => ({ data: null, error: new Error('Network') }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /suscribirme con mercado pago/i })[0])

    expect(await screen.findByText(/no se pudo iniciar el pago/i)).toBeInTheDocument()
    expect(redirectToCheckout).not.toHaveBeenCalled()
  })

  it('muestra un error si la pasarela no devuelve init_point', async () => {
    const invokeMock = vi.fn(async () => ({ data: { preapproval_id: 'PRE_1' }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /suscribirme con mercado pago/i })[0])

    expect(await screen.findByText(/no se pudo iniciar el pago/i)).toBeInTheDocument()
    expect(redirectToCheckout).not.toHaveBeenCalled()
  })

  it('muestra el botón de Stripe (USD) en los planes pagos', () => {
    renderModal()
    const stripeButtons = screen.getAllByRole('button', { name: /stripe/i })
    expect(stripeButtons).toHaveLength(2)
  })

  it('suscribirse con Stripe a PRO invoca stripe-checkout y redirige al url', async () => {
    const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_ABC'
    const invokeMock = vi.fn(async () => ({ data: { url: STRIPE_URL }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /stripe/i })[0])

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('stripe-checkout', {
        body: { plan: 'pro', userId: 'user-1' },
      })
    )
    await waitFor(() => expect(redirectToCheckout).toHaveBeenCalledWith(STRIPE_URL))
  })

  it('suscribirse con Stripe a HOGAR invoca con el plan hogar', async () => {
    const invokeMock = vi.fn(async () => ({ data: { url: 'https://checkout.stripe.com/c/pay/cs_ABC' }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /stripe/i })[1])

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('stripe-checkout', {
        body: { plan: 'hogar', userId: 'user-1' },
      })
    )
  })

  it('muestra estado de carga mientras se procesa el checkout de Stripe', async () => {
    let resolveInvoke!: (value: { data: unknown; error: unknown }) => void
    const invokeMock = vi.fn(
      () => new Promise<{ data: unknown; error: unknown }>((resolve) => (resolveInvoke = resolve))
    )
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /stripe/i })[0])

    expect(await screen.findByText(/procesando/i)).toBeInTheDocument()

    resolveInvoke({ data: { url: 'https://checkout.stripe.com/c/pay/cs_ABC' }, error: null })
    await waitFor(() => expect(redirectToCheckout).toHaveBeenCalled())
  })

  it('muestra un error sin redirigir si la Edge Function de Stripe falla', async () => {
    const invokeMock = vi.fn(async () => ({ data: null, error: new Error('Network') }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /stripe/i })[0])

    expect(await screen.findByText(/no se pudo iniciar el pago/i)).toBeInTheDocument()
    expect(redirectToCheckout).not.toHaveBeenCalled()
  })

  it('muestra un error si Stripe no devuelve url', async () => {
    const invokeMock = vi.fn(async () => ({ data: { session_id: 'cs_1' }, error: null }))
    Object.assign(supabaseMock, createSupabaseMock({ functions: { invoke: invokeMock } }))

    renderModal()
    await waitForSession()

    await userEvent.click(screen.getAllByRole('button', { name: /stripe/i })[0])

    expect(await screen.findByText(/no se pudo iniciar el pago/i)).toBeInTheDocument()
    expect(redirectToCheckout).not.toHaveBeenCalled()
  })
})
