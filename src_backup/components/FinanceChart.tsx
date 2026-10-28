'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { useTheme } from '@/context/ThemeContext'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

interface FinanceChartProps {
  income: number
  expense: number
}

export default function FinanceChart({ income, expense }: FinanceChartProps) {
  const { theme } = useTheme()

  const data = {
    labels: ['Ingresos', 'Gastos'],
    datasets: [
      {
        data: [income, expense],
        backgroundColor: ['#10b981', '#f43f5e'],
        borderColor: theme === 'dark' ? ['#111827', '#111827'] : ['#059669', '#e11d48'],
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: theme === 'dark' ? '#9ca3af' : '#4b5563' },
      },
    },
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Relación Ingresos vs Gastos</h3>
      {income === 0 && expense === 0 ? (
        <p className="text-xs text-gray-400 py-12">Sin datos para graficar aún.</p>
      ) : (
        <div className="w-48 h-48">
          <Doughnut data={data} options={options} />
        </div>
      )}
    </div>
  )
}