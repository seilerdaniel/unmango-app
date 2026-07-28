'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

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
    <div className="min-h-screen bg-amber-50/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-amber-100/60 space-y-6">
        
        {/* Branding UnMango */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 mb-2">
            <span className="text-3xl">🥭</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            UnMango
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            {isSignUp ? 'Crea tu cuenta para cuidar tus finanzas' : 'Inicia sesión para controlar hasta el último mango'}
          </p>
        </div>

        {/* Mensaje de error */}
        {errorMsg && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-semibold border border-rose-100 text-center">
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 font-medium text-sm placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition"
            />
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

        {/* Toggle Login/Registro */}
        <div className="text-center pt-2 border-t border-gray-100">
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