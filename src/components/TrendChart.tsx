'use client'

import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { supabase } from '@/lib/supabaseClient'
import { useTheme } from '@/context/ThemeContext'
import { TrendingUp } from 'lucide-react'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const MONTHS_TO_SHOW = 6

function formatMonthLabel(monthStart: string) {
  const date = new Date(`${monthStart}T00:00:00`)
  return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

export default function TrendChart() {
  const [rows, setRows] = useState<{ month_start: string; total_income: number; total_expense: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    async function loadTrend() {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_monthly_trend', {
          p_months: MONTHS_TO_SHOW,
        })
        if (rpcError) throw rpcError
        setRows(data ?? [])
      } catch (err) {
        console.error('Error cargando la tendencia mensual:', err)
        setError('No se pudo cargar la tendencia mensual.')
      } finally {
        setLoading(false)
      }
    }
    loadTrend()
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando tendencia...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <p className="text-xs font-semibold text-rose-600">{error}</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs text-gray-400">Todavía no hay suficientes movimientos para ver una tendencia.</p>
      </div>
    )
  }

  // chart.js dibuja en un <canvas>, así que no reacciona solo a las
  // clases dark: de Tailwind — hay que pasarle el color de texto/grilla
  // explícitamente según el tema activo.
  const isDark = theme === 'dark'
  const tickColor = isDark ? '#9ca3af' : '#4b5563'
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  const data = {
    labels: rows.map((r) => formatMonthLabel(r.month_start)),
    datasets: [
      {
        label: 'Ingresos',
        data: rows.map((r) => Number(r.total_income)),
        backgroundColor: '#10b981',
        borderRadius: 6,
      },
      {
        label: 'Gastos',
        data: rows.map((r) => Number(r.total_expense)),
        backgroundColor: '#f43f5e',
        borderRadius: 6,
      },
    ],
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-indigo-600" /> Tendencia — últimos {MONTHS_TO_SHOW} meses
      </h3>
      <div className="h-56">
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: tickColor } } },
            scales: {
              x: { ticks: { color: tickColor }, grid: { color: gridColor } },
              y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
            },
          }}
        />
      </div>
    </div>
  )
}
