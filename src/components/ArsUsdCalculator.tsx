'use client'

import { useEffect, useState } from 'react'
import { Calculator, X, RefreshCw } from 'lucide-react'

interface BlueRate {
  compra: number
  venta: number
}

/**
 * Conversiones puras ARS <-> USD dada una cotización, separadas del
 * componente para poder testearlas sin renderizar nada.
 */
export function arsToUsd(ars: number, rate: number): number | null {
  if (!(rate > 0) || !Number.isFinite(ars)) return null
  return ars / rate
}

export function usdToArs(usd: number, rate: number): number | null {
  if (!(rate > 0) || !Number.isFinite(usd)) return null
  return usd * rate
}

/**
 * Trae la cotización del dólar blue desde una API pública argentina
 * (dolarapi.com, sin necesidad de API key). Si falla (sin conexión, la
 * API caída, etc.) devuelve null — el usuario puede seguir usando la
 * calculadora cargando la cotización a mano.
 */
async function fetchBlueRate(): Promise<BlueRate | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue')
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.compra !== 'number' || typeof data.venta !== 'number') return null
    return { compra: data.compra, venta: data.venta }
  } catch {
    return null
  }
}

export default function ArsUsdCalculator() {
  const [isOpen, setIsOpen] = useState(false)
  const [blueRate, setBlueRate] = useState<BlueRate | null>(null)
  const [rateInput, setRateInput] = useState('')
  const [loadingRate, setLoadingRate] = useState(false)
  const [arsAmount, setArsAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [lastEdited, setLastEdited] = useState<'ars' | 'usd'>('ars')

  async function loadRate() {
    setLoadingRate(true)
    const rate = await fetchBlueRate()
    setBlueRate(rate)
    if (rate) setRateInput(String(rate.venta))
    setLoadingRate(false)
  }

  useEffect(() => {
    if (isOpen && !blueRate) {
      loadRate()
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const rate = Number(rateInput) || 0

  function handleArsChange(value: string) {
    setArsAmount(value)
    setLastEdited('ars')
    if (rate > 0) {
      const num = Number(value)
      const converted = value !== '' ? arsToUsd(num, rate) : null
      setUsdAmount(converted !== null ? converted.toFixed(2) : '')
    }
  }

  function handleUsdChange(value: string) {
    setUsdAmount(value)
    setLastEdited('usd')
    if (rate > 0) {
      const num = Number(value)
      const converted = value !== '' ? usdToArs(num, rate) : null
      setArsAmount(converted !== null ? converted.toFixed(2) : '')
    }
  }

  function handleRateChange(value: string) {
    setRateInput(value)
    const newRate = Number(value) || 0
    if (newRate <= 0) return
    // Recalcula el campo que no fue el último editado, para no pisar lo
    // que el usuario está escribiendo.
    if (lastEdited === 'ars' && arsAmount !== '') {
      const converted = arsToUsd(Number(arsAmount), newRate)
      if (converted !== null) setUsdAmount(converted.toFixed(2))
    } else if (lastEdited === 'usd' && usdAmount !== '') {
      const converted = usdToArs(Number(usdAmount), newRate)
      if (converted !== null) setArsAmount(converted.toFixed(2))
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(true)}
        title="Calculadora ARS / USD Blue"
        className="fixed bottom-[100px] right-5 z-40 bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-full shadow-lg shadow-emerald-600/30 transition cursor-pointer"
      >
        <Calculator size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calculator size={16} className="text-emerald-600" /> Calculadora ARS / USD Blue
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="flex items-center justify-between text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                <span>Cotización (venta)</span>
                <button
                  onClick={loadRate}
                  disabled={loadingRate}
                  className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={11} className={loadingRate ? 'animate-spin' : ''} />
                  actualizar
                </button>
              </label>
              <input
                type="number"
                value={rateInput}
                onChange={(e) => handleRateChange(e.target.value)}
                placeholder="Ej: 1450"
                className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
              />
              {!blueRate && !loadingRate && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  No se pudo traer la cotización automática — cargala a mano.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Pesos (ARS)</label>
                <input
                  type="number"
                  value={arsAmount}
                  onChange={(e) => handleArsChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-bold text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Dólares Blue (USD)</label>
                <input
                  type="number"
                  value={usdAmount}
                  onChange={(e) => handleUsdChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-bold text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
