'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { usePrivacy } from '@/context/PrivacyContext'
import {
  ExchangeRateQuote,
  fetchExchangeRates,
  quoteSell,
} from '@/lib/exchangeRates'

type ReferenceSource = 'mep' | 'blue'

const REFERENCE_SOURCE_KEY = 'unmango_reference_rate'

/**
 * Control de moneda y cotización del Balance Consolidado del Dashboard:
 * - Segmented ARS/USD → cambia la moneda en que se muestra todo el panel
 *   (vía displayCurrency de PrivacyContext).
 * - Selector MEP/Blue → elige qué cotización se usa como tipo de cambio
 *   de referencia para convertir (setBlueRate del context).
 *
 * Las cotizaciones salen de src/lib/exchangeRates.ts (dolarapi.com con
 * caché de 15 min en memoria/localStorage y fallback offline).
 */
export default function ExchangeRateControl() {
  const { displayCurrency, setDisplayCurrency, blueRate, setBlueRate } = usePrivacy()

  const [rates, setRates] = useState<ExchangeRateQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [reference, setReference] = useState<ReferenceSource>(() => {
    if (typeof window === 'undefined') return 'blue'
    return localStorage.getItem(REFERENCE_SOURCE_KEY) === 'mep' ? 'mep' : 'blue'
  })
  const hasBootstrapped = useRef(false)

  const applyReference = useCallback(
    (source: ReferenceSource, quotes: ExchangeRateQuote[]) => {
      const sell = quoteSell(quotes, source)
      if (sell !== null) setBlueRate(sell)
    },
    [setBlueRate]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setOffline(false)
    try {
      const quotes = await fetchExchangeRates()
      setRates(quotes)
      if (!hasBootstrapped.current) {
        applyReference(reference, quotes)
        hasBootstrapped.current = true
      }
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [applyReference, reference])

  useEffect(() => {
    // load es async; sus setState ocurren post-await (no sincrónico en el
    // effect), igual que en DollarRatesTable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const changeReference = (source: ReferenceSource) => {
    setReference(source)
    localStorage.setItem(REFERENCE_SOURCE_KEY, source)
    applyReference(source, rates)
  }

  const selected = quoteSell(rates, reference)
  const formatRate = (n: number) =>
    `$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)}`

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
      {/* Moneda de visualización */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
        <button
          onClick={() => setDisplayCurrency('ARS')}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
            displayCurrency === 'ARS' ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          ARS ($)
        </button>
        <button
          onClick={() => setDisplayCurrency('USD')}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
            displayCurrency === 'USD' ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          USD ($)
        </button>
      </div>

      {/* Cotización de referencia */}
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
        <span>Ref:</span>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
          <button
            onClick={() => changeReference('mep')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
              reference === 'mep' ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            MEP
          </button>
          <button
            onClick={() => changeReference('blue')}
            className={`px-1.5 py-0.5 rounded-md font-bold transition cursor-pointer ${
              reference === 'blue' ? 'bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Blue
          </button>
        </div>
        <span className="font-bold text-gray-700 dark:text-gray-200">
          {loading ? '…' : selected !== null ? formatRate(selected) : offline ? 'sin cotización' : formatRate(blueRate)}
        </span>
        <button
          onClick={load}
          disabled={loading}
          className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition p-0.5 cursor-pointer disabled:opacity-50"
          title="Actualizar cotizaciones (caché de 15 min)"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
