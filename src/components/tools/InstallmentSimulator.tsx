'use client'

import { ReactNode, useState } from 'react'
import { usePrivacy } from '@/context/PrivacyContext'
import { simulateInstallmentPurchase, InstallmentVerdict } from '@/lib/installmentSimulator'
import { Radar, X, TrendingUp, TrendingDown, Equal, ArrowRight } from 'lucide-react'

export interface ConvertToPurchaseData {
  description: string
  totalAmount: number
  installmentsCount: number
}

interface InstallmentSimulatorProps {
  onConvertToPurchase?: (data: ConvertToPurchaseData) => void
}

const VERDICT_STYLES: Record<InstallmentVerdict, { badge: string; label: string; icon: ReactNode }> = {
  BUY_INSTALLMENTS: {
    badge: 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300',
    label: '¡Te conviene comprar en cuotas!',
    icon: <TrendingDown size={16} />,
  },
  BUY_CASH: {
    badge: 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    label: '¡Te conviene pagar de contado!',
    icon: <TrendingUp size={16} />,
  },
  EQUIVALENT: {
    badge: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300',
    label: 'Da igual: el costo real es el mismo',
    icon: <Equal size={16} />,
  },
}

export default function InstallmentSimulator({ onConvertToPurchase }: InstallmentSimulatorProps) {
  const { formatAmount } = usePrivacy()
  const [isOpen, setIsOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [cashPrice, setCashPrice] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('')
  const [inflation, setInflation] = useState('')
  const [investmentTna, setInvestmentTna] = useState('')

  const canCalculate =
    Number(cashPrice) > 0 &&
    Number(installmentAmount) > 0 &&
    Number(installmentsCount) > 0 &&
    inflation !== ''

  const result = canCalculate
    ? simulateInstallmentPurchase({
        cashPrice: Number(cashPrice),
        installmentAmount: Number(installmentAmount),
        installmentCount: Number(installmentsCount),
        monthlyInflationRate: Number(inflation),
        investmentTna: investmentTna !== '' ? Number(investmentTna) : undefined,
      })
    : null

  function handleConvert() {
    if (!result || !onConvertToPurchase) return
    onConvertToPurchase({
      description: description.trim(),
      totalAmount: result.totalInstallmentPrice,
      installmentsCount: result.installmentCount,
    })
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold py-3 rounded-2xl transition cursor-pointer shadow-sm"
      >
        <Radar size={15} className="text-violet-600" /> Simulador Anti-inflación en Cuotas
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Radar size={16} className="text-violet-600" /> Simulador Anti-inflación
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Compara el costo real de financiar en cuotas vs. pagar contado: cada cuota futura se
              descuenta a poder de compra de HOY según la inflación mensual que vos estimes. No es
              asesoramiento financiero.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Notebook"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Precio contado</label>
                <input
                  type="number"
                  value={cashPrice}
                  onChange={(e) => setCashPrice(e.target.value)}
                  placeholder="100000"
                  min="1"
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
                  min="1"
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
                  max="60"
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
                  min="0"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  TNA inversión % (opcional)
                </label>
                <input
                  type="number"
                  value={investmentTna}
                  onChange={(e) => setInvestmentTna(e.target.value)}
                  placeholder="0"
                  step="any"
                  min="0"
                  title="Si el efectivo hoy podría invertirse, sumá la TNA como costo de oportunidad."
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {result && (
              <div className="space-y-3">
                <div
                  className={`flex items-center gap-2 border p-3.5 rounded-xl ${VERDICT_STYLES[result.verdict].badge}`}
                >
                  {VERDICT_STYLES[result.verdict].icon}
                  <p className="text-sm font-extrabold">{VERDICT_STYLES[result.verdict].label}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-0.5">
                    <p className="text-gray-400 font-semibold">Total financiado (nominal)</p>
                    <p className="font-bold text-gray-800 dark:text-gray-100">{formatAmount(result.totalInstallmentPrice)}</p>
                    <p className="text-gray-400">Recargo nominal: {result.nominalSurchargePercent}%</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-0.5">
                    <p className="text-gray-400 font-semibold">Costo real a valor de hoy</p>
                    <p className="font-bold text-gray-800 dark:text-gray-100">{formatAmount(result.presentValueFinanced)}</p>
                    <p className="text-gray-400">
                      {result.realSurcharge > 0 ? 'Recargo real: ' : 'Ahorro real: '}
                      {result.realSurchargePercent}%
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                    Impacto mes a mes (cuota nominal vs. costo real de hoy)
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {result.monthlyBreakdown.map((row) => (
                      <div key={row.installmentNumber} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-semibold w-16 shrink-0">Cuota {row.installmentNumber}</span>
                        <span className="text-gray-500 dark:text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                          {formatAmount(row.nominalAmount)}
                        </span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">
                          {formatAmount(row.presentValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {onConvertToPurchase && (
                  <button
                    onClick={handleConvert}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm cursor-pointer"
                  >
                    <ArrowRight size={15} /> Convertir en Compra en Cuotas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
