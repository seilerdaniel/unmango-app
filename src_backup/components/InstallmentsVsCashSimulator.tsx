'use client'

import { useState } from 'react'
import { usePrivacy } from '@/context/PrivacyContext'
import { compareInstallmentsVsCash } from '@/lib/installmentsVsCash'
import { Scale, X, TrendingUp } from 'lucide-react'

export default function InstallmentsVsCashSimulator() {
  const { formatAmount } = usePrivacy()
  const [isOpen, setIsOpen] = useState(false)
  const [cashPrice, setCashPrice] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('')
  const [inflation, setInflation] = useState('')

  const canCalculate =
    Number(cashPrice) > 0 && Number(installmentAmount) > 0 && Number(installmentsCount) > 0 && inflation !== ''

  const result = canCalculate
    ? compareInstallmentsVsCash(
        Number(cashPrice),
        Number(installmentAmount),
        Number(installmentsCount),
        Number(inflation)
      )
    : null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold py-3 rounded-2xl transition cursor-pointer shadow-sm"
      >
        <Scale size={15} className="text-violet-600" /> Simulador Contado vs. Cuotas
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Scale size={16} className="text-violet-600" /> Contado vs. Cuotas
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              No es asesoramiento financiero — es una cuenta simple con la inflación mensual que
              vos estimes, no una predicción real.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Precio contado</label>
                <input
                  type="number"
                  value={cashPrice}
                  onChange={(e) => setCashPrice(e.target.value)}
                  placeholder="100000"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Monto de cada cuota</label>
                <input
                  type="number"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  placeholder="10000"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Cantidad de cuotas</label>
                <input
                  type="number"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  placeholder="12"
                  min="1"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Inflación mensual %</label>
                <input
                  type="number"
                  value={inflation}
                  onChange={(e) => setInflation(e.target.value)}
                  placeholder="6"
                  step="any"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {result && (
              <div
                className={`p-3.5 rounded-xl border space-y-1.5 ${
                  result.recommendation === 'cuotas'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
                }`}
              >
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-gray-800 dark:text-gray-100">
                  <TrendingUp size={14} />
                  Conviene {result.recommendation === 'cuotas' ? 'financiar en cuotas' : 'pagar al contado'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Valor presente de las cuotas: {formatAmount(result.presentValueFinanced)} (nominal:{' '}
                  {formatAmount(result.totalFinanced)})
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {result.savingsAmount > 0
                    ? `Financiar te "ahorra" ${formatAmount(result.savingsAmount)} en poder de compra de hoy.`
                    : `Pagar contado te ahorra ${formatAmount(Math.abs(result.savingsAmount))} frente a financiar.`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
