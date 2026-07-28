'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  /**
   * Variante "OLED": en modo oscuro, usa negro puro (#000) en vez del
   * gris oscuro habitual — en pantallas OLED cada píxel negro está
   * literalmente apagado, así que ahorra batería de verdad (no es solo
   * estético). No tiene efecto en modo claro.
   *
   * Nota de alcance: esto es la única variante de tema extra que se
   * implementó. Paletas de color completas (ej. "Cyber Neon") no se
   * hicieron porque la app hoy usa un color de acento DISTINTO por
   * sección (ámbar en transacciones, índigo en billeteras, esmeralda en
   * ahorro) en vez de un único color de marca reemplazable — reskinearlo
   * bien requeriría antes unificar esos colores en un sistema de tokens,
   * que es un trabajo de diseño aparte, no un ajuste rápido.
   */
  oledBlack: boolean
  toggleOledBlack: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'unmango_theme'
const OLED_STORAGE_KEY = 'unmango_oled_black'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [oledBlack, setOledBlack] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial =
      saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')

    const savedOled = localStorage.getItem(OLED_STORAGE_KEY) === 'true'
    setOledBlack(savedOled)
    document.documentElement.classList.toggle('oled', savedOled)
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEY, next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }

  const toggleOledBlack = () => {
    setOledBlack((prev) => {
      const next = !prev
      localStorage.setItem(OLED_STORAGE_KEY, String(next))
      document.documentElement.classList.toggle('oled', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, oledBlack, toggleOledBlack }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider')
  }
  return context
}
