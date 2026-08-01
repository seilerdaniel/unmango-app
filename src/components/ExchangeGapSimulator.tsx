'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { useUser } from '@/context/UserContext'
import { buildExchangeGapSeries, computeGapSummary, NetWorthSnapshot } from '@/lib/exchangeGap'
import { Scale, RefreshCw } from 'lucide-react'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

async function fetchBlueRate(): Promise<number | null> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue')
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.venta === 'number' ? data.venta : null
  } catch {
    return null
  }
}

export default function ExchangeGapSimulator() {
  const { user } = useUser()
  const { isPrivate, formatAmount } = usePrivacy()
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [takingSnapshot, setTakingSnapshot] = useState(false)

  const loadSnapshots = useCallback(async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })

      if (error) throw error

      setSnapshots(
        (data ?? []).map((row) => ({
          snapshotDate: row.snapshot_date,
          totalBalanceArs: Number(row.total_balance_ars),
          usdBlueRate: Number(row.usd_blue_rate),
        }))
      )
    } catch (err) {
      console.error('Error cargando snapshots de patrimonio:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  async function handleTakeSnapshot() {
    setTakingSnapshot(true)
    try {
      if (!user) return

      const [{ data: totalsData, error: totalsError }, blueRate] = await Promise.all([
        supabase.rpc('get_transaction_totals'),
        fetchBlueRate(),
      ])

      if (totalsError) throw totalsError
      if (blueRate === null) {
        alert('No se pudo obtener la cotización del dólar Blue justo ahora. Probá de nuevo en un rato.')
        return
      }

      const totalIncome = Number(totalsData?.[0]?.total_income) || 0
      const totalExpense = Number(totalsData?.[0]?.total_expense) || 0
      const balance = totalIncome - totalExpense

      // upsert: si ya tomaste un snapshot hoy, lo actualiza en vez de
      // duplicar (unique constraint en user_id + snapshot_date).
      const { error } = await supabase.from('net_worth_snapshots').upsert(
        {
          user_id: user.id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          total_balance_ars: balance,
          usd_blue_rate: blueRate,
        },
        { onConflict: 'user_id,snapshot_date' }
      )

      if (error) throw error
      await loadSnapshots()
    } catch (err) {
      alert('Error al tomar el snapshot: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error tomando snapshot de patrimonio:', err)
    } finally {
      setTakingSnapshot(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando...</p>
      </div>
    )
  }

  const series = buildExchangeGapSeries(snapshots)
  const summary = computeGapSummary(snapshots)

  const chartData = {
    labels: series.map((p) => new Date(`${p.date}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })),
    datasets: [
      {
        label: 'Patrimonio en ARS',
        data: series.map((p) => p.balanceArs),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b22',
        yAxisID: 'y',
        tension: 0.3,
      },
      {
        label: 'Equivalente en USD Blue',
        data: series.map((p) => p.balanceUsdEquivalent),
        borderColor: '#06b6d4',
        backgroundColor: '#06b6d422',
        yAxisID: 'y1',
        tension: 0.3,
      },
    ],
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Scale size={16} className="text-cyan-600" /> Brecha Cambiaria
        </h3>
        <button
          onClick={handleTakeSnapshot}
          disabled={takingSnapshot}
          className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 hover:bg-cyan-100 dark:hover:bg-cyan-950/50 px-2.5 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={11} className={takingSnapshot ? 'animate-spin' : ''} />
          {takingSnapshot ? 'Tomando...' : 'Tomar snapshot hoy'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-xs text-gray-400">
          Todavía no hay ningún snapshot — tocá &quot;Tomar snapshot hoy&quot; para registrar tu
          patrimonio actual junto con la cotización del dólar Blue de hoy. No se puede reconstruir
          la evolución pasada (no había esto guardado antes); a partir de ahora, cada snapshot que
          tomes arma el gráfico.
        </p>
      ) : snapshots.length === 1 ? (
        <p className="text-xs text-gray-400">
          Tenés 1 snapshot tomado. Volvé a tomar otro en unos días (o semanas) para empezar a ver
          la evolución de tu patrimonio en pesos vs. su equivalente en dólares Blue.
        </p>
      ) : (
        <>
          <div className="h-48">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                scales: {
                  y: { position: 'left', ticks: { display: !isPrivate } },
                  y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { display: !isPrivate } },
                },
              }}
            />
          </div>

          {summary && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Desde el primer snapshot, tu patrimonio en pesos{' '}
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {summary.arsGrowthPercent >= 0 ? 'creció' : 'bajó'} {Math.abs(summary.arsGrowthPercent).toFixed(1)}%
              </span>
              . Medido en dólares Blue (tu poder de compra real),{' '}
              <span className={`font-bold ${summary.gapPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {summary.gapPercent >= 0
                  ? `le ganaste ${summary.gapPercent.toFixed(1)}% a la devaluación`
                  : `perdiste ${Math.abs(summary.gapPercent).toFixed(1)}% de valor real`}
              </span>
              .
            </p>
          )}
        </>
      )}

      {!isPrivate && snapshots.length > 0 && (
        <p className="text-[10px] text-gray-400">
          Último snapshot: {formatAmount(snapshots[snapshots.length - 1].totalBalanceArs)} · dólar Blue $
          {snapshots[snapshots.length - 1].usdBlueRate}
        </p>
      )}
    </div>
  )
}
