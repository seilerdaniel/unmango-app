'use client'

import { useEffect, useState } from 'react'
import { X, Crown, Home, Sparkles, Check, Star, Loader2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { useUser } from '@/context/UserContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { Plan } from '@/lib/subscription'
import { supabase } from '@/lib/supabaseClient'
import { redirectToCheckout } from '@/lib/checkout'

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan: Plan
}

const PLANS: Array<{
  id: Plan
  name: string
  price: string
  features: string[]
  icon: typeof Crown
  iconClass: string
  buttonClass: string
  highlight?: boolean
}> = [
  {
    id: 'free',
    name: 'FREE',
    price: '$0',
    features: ['Control esencial', 'Hasta 2 billeteras', 'Presupuestos básicos'],
    icon: Sparkles,
    iconClass: 'text-gray-400',
    buttonClass: 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$9.99',
    features: ['Bot IA 360°', 'TNA Billeteras', 'Multi-divisa', 'Bolsillo de Cambio', 'Reportes PDF'],
    icon: Crown,
    iconClass: 'text-amber-500',
    buttonClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    highlight: true,
  },
  {
    id: 'hogar',
    name: 'HOGAR',
    price: '$29.99',
    features: ['Todo lo de PRO', 'Finanzas colaborativas hasta 4 integrantes'],
    icon: Home,
    iconClass: 'text-emerald-600',
    buttonClass: 'border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
  },
]

const PLAN_LABEL: Record<Plan, string> = { free: 'FREE', pro: 'PRO', hogar: 'HOGAR' }

/**
 * Modal de precios / paywall. Tanda 11d trajo las tarjetas comparativas
 * (FREE / PRO / HOGAR) y el paywall simulado; la Tanda 12a suma el flujo
 * real de pago: "Suscribirme con Mercado Pago" llama a la Edge Function
 * mercadopago-checkout y redirige al checkout seguro (init_point) de
 * Mercado Pago en ARS. Al abrir el modal se refresca la suscripción del
 * usuario para reflejar un pago recién aprobado al volver.
 */
export default function PricingModal({ isOpen, onClose, currentPlan }: PricingModalProps) {
  const { toast } = useToast()
  const { user } = useUser()
  const { refresh } = useSubscription()
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null)

  useEffect(() => {
    if (isOpen) {
      refresh()
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [isOpen, refresh])

  if (!isOpen) return null

  async function handleSubscribe(plan: Plan) {
    if (plan === currentPlan) return
    if (!user) {
      toast.error('Iniciá sesión para suscribirte.')
      return
    }

    setCheckoutPlan(plan)
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
        body: { plan, userId: user.id },
      })
      if (error) throw error

      const initPoint = data?.init_point as string | undefined
      if (!initPoint) throw new Error('La pasarela no devolvió un link de pago.')

      toast.success('Te estamos llevando al checkout seguro de Mercado Pago...')
      redirectToCheckout(initPoint)
    } catch (err) {
      console.error('Error iniciando el checkout de Mercado Pago:', err)
      toast.error('No se pudo iniciar el pago. Probá de nuevo en un rato.')
    } finally {
      setCheckoutPlan(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Planes y precios">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden">
        <div className="sticky top-0 bg-white dark:bg-gray-900 px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" /> Planes UnMango
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition cursor-pointer"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Tu plan actual: <span className="font-bold text-gray-900 dark:text-gray-100">{PLAN_LABEL[currentPlan]}</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const Icon = plan.icon
              const isCurrent = plan.id === currentPlan
              const isProcessing = checkoutPlan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative p-5 rounded-2xl border flex flex-col gap-4 ${
                    plan.highlight
                      ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20 shadow-md'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-800/40'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${plan.iconClass}`} />
                    <h3 className="text-base font-black text-gray-900 dark:text-gray-100">{plan.name}</h3>
                    {isCurrent && (
                      <span className="ml-auto text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                        Actual
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                      {plan.price}
                      <span className="text-xs font-semibold text-gray-400">/mes</span>
                    </p>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                        <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isCurrent || (checkoutPlan !== null && !isProcessing)}
                    className={`w-full text-xs font-bold py-2.5 px-3 rounded-xl transition cursor-pointer disabled:opacity-60 disabled:cursor-default flex items-center justify-center gap-1.5 ${plan.buttonClass}`}
                  >
                    {isCurrent ? (
                      'Tu plan actual'
                    ) : isProcessing ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Procesando...
                      </>
                    ) : (
                      'Suscribirme con Mercado Pago'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
