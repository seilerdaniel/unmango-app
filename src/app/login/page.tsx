'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'

// Proveedores de login social vía Supabase Auth (OAuth). El código ya
// está listo para funcionar, pero cada uno necesita que actives el
// proveedor correspondiente en tu proyecto de Supabase (Authentication >
// Providers) con tus propias credenciales de OAuth de Google/Microsoft/
// Apple — eso es algo que tenés que hacer vos en el dashboard, no algo
// que se pueda dejar activado desde acá. Mientras no lo actives, el
// botón va a fallar con un error de Supabase indicando que el proveedor
// no está configurado.
const OAUTH_PROVIDERS: { id: 'google' | 'azure' | 'apple'; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'azure', label: 'Microsoft' },
  { id: 'apple', label: 'Apple' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  async function handleOAuthLogin(provider: 'google' | 'azure' | 'apple') {
    setOauthLoading(provider)
    setErrorMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setErrorMsg(
        `No se pudo iniciar sesión con ${provider}: ${error.message}. Si nunca lo probaste antes, puede que este proveedor todavía no esté activado en el proyecto de Supabase.`
      )
      setOauthLoading(null)
    }
    // Si no hay error, Supabase redirige a la pantalla del proveedor —
    // no hace falta hacer nada más acá.
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })
      if (error) {
        setErrorMsg(error.message)
      } else {
        alert('¡Registro exitoso! Ya puedes iniciar sesión.')
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
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-amber-50/40 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-amber-100/60 dark:border-gray-800 space-y-6">
        
        {/* Branding UnMango */}
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
          <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs font-semibold border border-rose-100 dark:border-rose-900/50 text-center">
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Correo Electrónico</label>
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
            <label htmlFor="login-password" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
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

          <div className="grid grid-cols-3 gap-2">
            {OAUTH_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleOAuthLogin(provider.id)}
                disabled={oauthLoading !== null}
                title={`Continuar con ${provider.label}`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition disabled:opacity-50 cursor-pointer"
              >
                {oauthLoading === provider.id ? '...' : provider.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            Necesitás tener el proveedor activado en Supabase (Authentication → Providers) para
            que esto funcione. Login por teléfono todavía no está — requiere contratar un servicio
            de SMS aparte (ej. Twilio) en tu proyecto de Supabase.
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
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
          >
            {isSignUp
              ? '¿Ya tienes una cuenta? Inicia sesión aquí'
              : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>

      </div>
    </div>
  )
}