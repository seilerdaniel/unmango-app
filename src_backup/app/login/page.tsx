'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useToast } from '@/context/ToastContext'
import { LogIn, UserPlus, Eye, EyeOff, Wallet, Sparkles, ShieldCheck } from 'lucide-react'

type OAuthProvider = 'google' | 'azure'

// Proveedores de login social vía Supabase Auth (OAuth). Google y Microsoft
// quedan visibles. **Apple está oculto a propósito** hasta que haya una
// membresía activa de Apple Developer (sin credenciales OAuth de Apple,
// Supabase no puede habilitar el provider). Para que cada botón funcione
// hay que activar el proveedor en Authentication → Providers con sus
// credenciales — eso se hace en el dashboard de Supabase, no en el código.
const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'azure', label: 'Microsoft' },
]

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  azure: 'Microsoft',
}

// Íconos de marca oficiales (SVG inline para no depender de assets).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path fill="#F35325" d="M1 1h10v10H1z" />
      <path fill="#81BC06" d="M12 1h10v10H12z" />
      <path fill="#05A6F0" d="M1 12h10v10H1z" />
      <path fill="#FFBA08" d="M12 12h10v10H12z" />
    </svg>
  )
}

const PROVIDER_ICONS: Record<OAuthProvider, () => React.ReactElement> = {
  google: GoogleIcon,
  azure: MicrosoftIcon,
}

const BRAND_POINTS: { icon: typeof Wallet; title: string; description: string }[] = [
  {
    icon: Wallet,
    title: 'Control total',
    description: 'Ingresos, gastos, presupuestos y billeteras en un solo lugar.',
  },
  {
    icon: Sparkles,
    title: 'Consejos 360°',
    description: 'Cotizaciones, rendimientos, cuotas y proyecciones al día.',
  },
  {
    icon: ShieldCheck,
    title: 'Privado y seguro',
    description: 'Tus datos son solo tuyos, protegidos con Row Level Security.',
  },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  async function handleOAuthLogin(provider: OAuthProvider) {
    setOauthLoading(provider)
    setErrorMsg(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      })
      if (error) {
        setErrorMsg(
          `No se pudo iniciar sesión con ${PROVIDER_LABEL[provider]}: ${error.message}. Verificá que el proveedor esté activado en Supabase (Authentication → Providers).`
        )
      }
      // Si no hay error, Supabase redirige a la pantalla del proveedor —
      // no hace falta hacer nada más acá.
    } catch (err) {
      console.error('Error inesperado en el login social:', err)
      setErrorMsg('Ocurrió un error inesperado. Probá de nuevo en un rato.')
    } finally {
      setOauthLoading(null)
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) {
          setErrorMsg(error.message)
        } else {
          toast.success('¡Registro exitoso! Ya puedes iniciar sesión.')
          setIsSignUp(false)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          setErrorMsg('Email o contraseña incorrectos.')
        } else {
          router.push('/')
          router.refresh()
        }
      }
    } catch (err) {
      console.error('Error inesperado en el login:', err)
      setErrorMsg('Ocurrió un error inesperado. Probá de nuevo en un rato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-amber-50/50 dark:bg-gray-950 lg:grid lg:grid-cols-2">
      {/* Panel de marca (solo desktop) */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-10 xl:p-14 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-orange-900/20 rounded-full blur-2xl" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl shadow-lg">
            🥭
          </div>
          <div>
            <p className="text-3xl font-extrabold text-white tracking-tight">UnMango</p>
            <p className="text-amber-100 text-sm font-medium">Tus finanzas, en orden.</p>
          </div>
        </div>

        <ul className="relative space-y-5">
          {BRAND_POINTS.map((point) => {
            const Icon = point.icon
            return (
              <li key={point.title} className="flex items-start gap-3">
                <span className="mt-0.5 w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white shrink-0">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-white font-bold text-sm">{point.title}</p>
                  <p className="text-amber-50/90 text-xs leading-relaxed">{point.description}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <p className="relative text-amber-100/80 text-xs font-medium">
          🥭 Cada peso (y cada dólar) cuenta.
        </p>
      </div>

      {/* Tarjeta de autenticación */}
      <div className="flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-100/60 dark:border-gray-800 space-y-6 my-8">
          {/* Branding */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 mb-2">
              <span className="text-3xl">🥭</span>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
              UnMango
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              {isSignUp ? 'Crea tu cuenta para cuidar tus finanzas' : 'Inicia sesión para controlar hasta el último mango'}
            </p>
          </div>

          {/* Mensaje de error */}
          {errorMsg && (
            <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs font-semibold border border-rose-100 dark:border-rose-900/50 text-center" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-default"
            >
              {loading ? (
                'Cargando...'
              ) : isSignUp ? (
                <>
                  <UserPlus size={18} /> Registrarme
                </>
              ) : (
                <>
                  <LogIn size={18} /> Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Login social (OAuth) */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">o continuá con</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {OAUTH_PROVIDERS.map((provider) => {
                const Icon = PROVIDER_ICONS[provider.id]
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleOAuthLogin(provider.id)}
                    disabled={oauthLoading !== null}
                    title={`Continuar con ${provider.label}`}
                    aria-label={`Continuar con ${provider.label}`}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Icon />
                    {oauthLoading === provider.id ? '...' : provider.label}
                  </button>
                )
              })}
            </div>

            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              Necesitás tener el proveedor activado en Supabase (Authentication → Providers) para
              que esto funcione. El login con Apple está deshabilitado temporalmente. Login por
              teléfono todavía no está — requiere un servicio de SMS aparte (ej. Twilio).
            </p>
          </div>

          {/* Toggle Login/Registro */}
          <div className="text-center pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setErrorMsg(null)
              }}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition cursor-pointer"
            >
              {isSignUp
                ? '¿Ya tenés cuenta? Iniciá sesión'
                : '¿No tenés cuenta? Registrate gratis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
