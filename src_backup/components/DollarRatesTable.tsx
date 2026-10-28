'use client'

import { useEffect, useState } from 'react'
import { Landmark, RefreshCw } from 'lucide-react'
import { computeRateGapPercent } from '@/lib/dollarRateGap'

interface DollarRate {
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

// Los 3 tipos que pide el rediseño — dolarapi.com tiene más (mayorista,
// tarjeta, cripto, CCL) pero para no saturar la tarjeta nos quedamos
// con los 3 de referencia más comunes.
const RELEVANT_TYPES = ['oficial', 'blue', 'bolsa']
const DISPLAY_NAME: Record<string, string> = { oficial: 'Oficial', blue: 'Blue', bolsa: 'MEP' }

async function fetchAllRates(): Promise<DollarRate[] | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares')
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

export default function DollarRatesTable() {
  const [rates, setRates] = useState<DollarRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    const data = await fetchAllRates()
    if (data) {
      setRates(data.filter((r) => RELEVANT_TYPES.includes(r.casa)))
    } else {
      setError(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    // load es async; sus setState ocurren post-await, no sincrónicos en el
    // effect (falso positivo de react-hooks/set-state-in-effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [])

  const oficial = rates.find((r) => r.casa === 'oficial')
  const blue = rates.find((r) => r.casa === 'blue')
  const brechaBlue = computeRateGapPercent(oficial?.venta ?? null, blue?.venta ?? null)

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Landmark size={16} className="text-gray-500" /> Cotizaciones del Dólar
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer disabled:opacity-50"
          title="Actualizar"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No se pudieron traer las cotizaciones justo ahora. Probá actualizar en un rato.
        </p>
      ) : loading ? (
        <p className="text-xs text-gray-400 animate-pulse">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {RELEVANT_TYPES.map((type) => {
            const rate = rates.find((r) => r.casa === type)
            if (!rate) return null
            return (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-600 dark:text-gray-300">{DISPLAY_NAME[type]}</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  ${rate.compra.toLocaleString('es-AR')} / ${rate.venta.toLocaleString('es-AR')}
                </span>
              </div>
            )
          })}
          {brechaBlue !== null && (
            <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
              Brecha Blue vs. Oficial: <span className="font-bold text-gray-600 dark:text-gray-300">{brechaBlue.toFixed(1)}%</span>
            </p>
          )}
          <p className="text-[10px] text-gray-400">Compra / Venta · fuente dolarapi.com</p>
        </div>
      )}
    </div>
  )
}
