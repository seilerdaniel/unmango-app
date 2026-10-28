'use client'

import { useEffect, useState } from 'react'
import { DollarSign, RefreshCw, TrendingUp } from 'lucide-react'
import { usePrivacy } from '@/context/PrivacyContext'

interface DolarRate {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

export default function DolarWidget() {
  const [blueRate, setLocalBlueRate] = useState<DolarRate | null>(null)
  const [oficialRate, setOficialRate] = useState<DolarRate | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  const { setBlueRate, displayCurrency, setDisplayCurrency } = usePrivacy()

  const fetchRates = async () => {
    setRefreshing(true)
    try {
      const [resBlue, resOficial] = await Promise.all([
        fetch('https://dolarapi.com/v1/dolares/blue'),
        fetch('https://dolarapi.com/v1/dolares/oficial')
      ])

      if (resBlue.ok) {
        const dataBlue: DolarRate = await resBlue.json()
        setLocalBlueRate(dataBlue)
        if (dataBlue.venta > 0) {
          setBlueRate(dataBlue.venta) // Actualiza el context con el dólar blue venta
        }
      }

      if (resOficial.ok) {
        setOficialRate(await resOficial.json())
      }
    } catch (error) {
      console.error('Error obteniendo cotizaciones:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [resBlue, resOficial] = await Promise.all([
          fetch('https://dolarapi.com/v1/dolares/blue'),
          fetch('https://dolarapi.com/v1/dolares/oficial')
        ])

        if (isMounted) {
          if (resBlue.ok) {
            const dataBlue: DolarRate = await resBlue.json()
            setLocalBlueRate(dataBlue)
            if (dataBlue.venta > 0) setBlueRate(dataBlue.venta)
          }
          if (resOficial.ok) {
            setOficialRate(await resOficial.json())
          }
        }
      } catch (error) {
        console.error('Error obteniendo cotizaciones:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [setBlueRate])

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center animate-pulse">
        <span className="text-xs font-medium text-gray-400">Cargando cotizaciones del Dólar...</span>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-emerald-700">
          <TrendingUp size={18} />
          <h3 className="text-xs font-black uppercase tracking-wider">Cotizaciones & Moneda</h3>
        </div>

        {/* Switcher de Moneda Global */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
          <button
            onClick={() => setDisplayCurrency('ARS')}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
              displayCurrency === 'ARS' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500'
            }`}
          >
            ARS ($)
          </button>
          <button
            onClick={() => setDisplayCurrency('USD')}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
              displayCurrency === 'USD' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500'
            }`}
          >
            USD ($)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Dólar Blue */}
        <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900">Dólar Blue</span>
            <button
              onClick={fetchRates}
              disabled={refreshing}
              className="text-emerald-600 hover:text-emerald-800 transition p-0.5 cursor-pointer disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-emerald-600 font-medium">C: ${blueRate?.compra ?? '-'}</span>
            <span className="text-xs font-black text-emerald-950">V: ${blueRate?.venta ?? '-'}</span>
          </div>
        </div>

        {/* Dólar Oficial */}
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-800">Dólar Oficial</span>
            <DollarSign size={13} className="text-gray-400" />
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] text-gray-500 font-medium">C: ${oficialRate?.compra ?? '-'}</span>
            <span className="text-xs font-black text-gray-900">V: ${oficialRate?.venta ?? '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}