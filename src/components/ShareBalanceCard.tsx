'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrivacy } from '@/context/PrivacyContext'
import { buildShareCardLines } from '@/lib/shareCard'
import { Share2, X, Download, Eye, EyeOff } from 'lucide-react'

interface ShareBalanceCardProps {
  balance: number
  totalIncome: number
  totalExpense: number
}

const CARD_WIDTH = 600
const CARD_HEIGHT = 400

export default function ShareBalanceCard({ balance, totalIncome, totalExpense }: ShareBalanceCardProps) {
  const { formatAmount } = usePrivacy()
  const [isOpen, setIsOpen] = useState(false)
  const [revealAmounts, setRevealAmounts] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const monthLabel = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  useEffect(() => {
    if (!isOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const lines = buildShareCardLines(
      { balance, totalIncome, totalExpense, monthLabel: monthLabelCapitalized },
      revealAmounts,
      formatAmount
    )

    // Fondo con gradiente
    const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
    gradient.addColorStop(0, '#1e1b4b')
    gradient.addColorStop(1, '#312e81')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    // Encabezado
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('🥭 UnMango', 40, 60)

    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#c7d2fe'
    ctx.fillText(lines.find((l) => l.label === 'Período')?.value ?? '', 40, 85)

    // Líneas de datos (todo menos "Período", que ya fue arriba)
    let y = 160
    for (const line of lines.filter((l) => l.label !== 'Período')) {
      ctx.font = '15px sans-serif'
      ctx.fillStyle = '#a5b4fc'
      ctx.fillText(line.label.toUpperCase(), 40, y)

      ctx.font = 'bold 34px sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(line.value, 40, y + 38)

      y += 80
    }

    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#818cf8'
    ctx.fillText('Generado con UnMango', 40, CARD_HEIGHT - 20)
  }, [isOpen, revealAmounts, balance, totalIncome, totalExpense, monthLabelCapitalized, formatAmount])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `unmango-balance-${new Date().toISOString().slice(0, 10)}.png`
    a.click()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
      >
        <Share2 size={14} /> <span className="hidden sm:inline">Compartir balance</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Compartir balance</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              className="w-full rounded-xl border border-gray-100 dark:border-gray-800"
            />

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setRevealAmounts((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
              >
                {revealAmounts ? <EyeOff size={14} /> : <Eye size={14} />}
                {revealAmounts ? 'Ocultar montos' : 'Mostrar montos reales'}
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                <Download size={14} /> Descargar imagen
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Por defecto los montos quedan censurados — solo se muestran si tocás &quot;Mostrar
              montos reales&quot; antes de descargar.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
