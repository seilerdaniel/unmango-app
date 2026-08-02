'use client'

import { useMemo, useState } from 'react'
import { usePrivacy } from '@/context/PrivacyContext'
import {
  buildInterestFreeOption,
  simulateInstallmentPurchase,
  type FinancingOptionInput,
  type InstallmentPurchaseSimulationResult,
} from '@/lib/installmentSimulator'
import { Gauge, X, Plus, Trash2, TrendingUp, Sparkles, ArrowRight } from 'lucide-react'

export interface ConvertToInstallmentPlan {
  description: string
  /** Monto total nominal (lo que se paga en total financiado). */
  totalAmount: number
  installmentsCount: number
}

interface InstallmentSimulatorProps {
  /** Dispara la alta en Compras en Cuotas con el plan elegido precargado. */
  onConvertToInstallmentPurchase: (plan: ConvertToInstallmentPlan) => void
}

interface OptionRow {
  id: string
  installmentsCount: string
  installmentAmount: string
  interestFree: boolean
}

function newRowId() {
  return `opt-${Math.random().toString(36).slice(2, 9)}`
}

export default function InstallmentSimulator({ onConvertToInstallmentPurchase }: InstallmentSimulatorProps) {
  const { formatAmount } = usePrivacy()
  const [isOpen, setIsOpen] = useState(false)
  const [cashPrice, setCashPrice] = useState('')
  const [description, setDescription] = useState('')
  const [inflation, setInflation] = useState('')
  const [rows, setRows] = useState<OptionRow[]>([
    { id: newRowId(), installmentsCount: '3', installmentAmount: '', interestFree: true },
    { id: newRowId(), installmentsCount: '6', installmentAmount: '', interestFree: true },
  ])

  const parsedCash = Number(cashPrice)
  const parsedInflation = inflation === '' ? null : Number(inflation)

  const options = useMemo<FinancingOptionInput[]>(() => {
    const cash = Number(cashPrice)
    return rows.flatMap((row) => {
      const count = Number(row.installmentsCount)
      if (!Number.isInteger(count) || count < 1) return []
      if (row.interestFree) {
        if (!(cash > 0)) return []
        return [{ ...buildInterestFreeOption(count, cash), id: row.id }]
      }
      const amount = Number(row.installmentAmount)
      if (!(amount > 0)) return []
      return [{ id: row.id, installmentsCount: count, installmentAmount: amount }]
    })
  }, [rows, cashPrice])

  const canCalculate = parsedCash > 0 && parsedInflation !== null && options.length > 0

  const results = useMemo<InstallmentPurchaseSimulationResult[] | null>(() => {
    if (!canCalculate || parsedInflation === null) return null
    return simulateInstallmentPurchase({ cashPrice: parsedCash, monthlyInflationPercent: parsedInflation, options })
  }, [canCalculate, parsedCash, parsedInflation, options])

  const displayResults = useMemo(
    () => (results ? [...results].sort((a, b) => b.savingsVsCash - a.savingsVsCash) : []),
    [results]
  )

  function updateRow(id: string, patch: Partial<OptionRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function convert(plan: ConvertToInstallmentPlan) {
    setIsOpen(false)
    onConvertToInstallmentPurchase(plan)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold py-3 rounded-2xl transition cursor-pointer shadow-sm"
      >
        <Gauge size={15} className="text-emerald-600" /> Simulador Anti-inflación (cuotas vs. contado)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5 space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Gauge size={16} className="text-emerald-600" /> Simulador Anti-inflación
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar simulador"
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Compara contado vs. varias opciones de cuotas descontando la inflación mensual que vos
              estimes. No es asesoramiento financiero — es una cuenta simple, no una predicción real.
            </p>

            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="sim-product-name"
                  className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1"
                >
                  Nombre del producto (opcional)
                </label>
                <input
                  id="sim-product-name"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Heladera"
                  className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-cash-price"
                    className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Precio contado
                  </label>
                  <input
                    id="sim-cash-price"
                    type="number"
                    value={cashPrice}
                    onChange={(e) => setCashPrice(e.target.value)}
                    placeholder="100000"
                    min="1"
                    step="any"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-inflation"
                    className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Inflación mensual %
                  </label>
                  <input
                    id="sim-inflation"
                    type="number"
                    value={inflation}
                    onChange={(e) => setInflation(e.target.value)}
                    placeholder="6"
                    step="any"
                    className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
                Opciones de financiación
              </p>
              {rows.map((row) => (
                <div key={row.id} className="flex items-end gap-1.5">
                  <div className="w-16 shrink-0">
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">Cuotas</label>
                    <input
                      type="number"
                      value={row.installmentsCount}
                      onChange={(e) => updateRow(row.id, { installmentsCount: e.target.value })}
                      placeholder="6"
                      min="1"
                      max="60"
                      className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 font-semibold text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">Monto por cuota</label>
                    <input
                      type="number"
                      value={row.interestFree ? '' : row.installmentAmount}
                      onChange={(e) => updateRow(row.id, { installmentAmount: e.target.value, interestFree: false })}
                      placeholder={row.interestFree ? `= contado ÷ ${row.installmentsCount || 'N'}` : '10000'}
                      disabled={row.interestFree}
                      min="1"
                      step="any"
                      className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 font-semibold text-gray-800 dark:text-gray-100 disabled:opacity-50"
                    />
                  </div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 pb-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={row.interestFree}
                      onChange={(e) => updateRow(row.id, { interestFree: e.target.checked })}
                      className="accent-emerald-600"
                    />
                    sin interés
                  </label>
                  <button
                    onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                    disabled={rows.length <= 1}
                    aria-label="Quitar opción"
                    className="text-gray-400 hover:text-rose-600 transition p-1 pb-2 cursor-pointer disabled:opacity-30 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    { id: newRowId(), installmentsCount: '12', installmentAmount: '', interestFree: true },
                  ])
                }
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900 rounded-xl py-2 transition cursor-pointer"
              >
                <Plus size={13} /> Agregar opción
              </button>
            </div>

            {!canCalculate && (
              <p className="text-[10px] text-gray-400">
                Cargá el precio de contado, la inflación mensual y al menos una opción de cuotas para
                comparar.
              </p>
            )}

            {displayResults.length > 0 && (
              <div className="space-y-2.5">
                {displayResults.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      result.isBestOption
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-extrabold text-gray-800 dark:text-gray-100">
                        {result.installmentsCount} cuotas de {formatAmount(result.installmentAmount)}
                      </p>
                      {result.isBestOption && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/40 rounded-full px-2 py-0.5 shrink-0">
                          <Sparkles size={11} /> Mejor opción
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div>
                        <p className="text-gray-400">Total (nominal)</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300">
                          {formatAmount(result.totalNominal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Costo real (hoy)</p>
                        <p className="font-bold text-gray-700 dark:text-gray-300">
                          {formatAmount(result.presentValue)}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`flex items-center gap-1.5 text-[11px] font-bold ${
                        result.recommendation === 'cuotas' ? 'text-emerald-600' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <TrendingUp size={13} />
                      {result.recommendation === 'cuotas'
                        ? `Conviene financiar: te "ahorra" ${formatAmount(result.savingsVsCash)} de hoy`
                        : `Conviene contado: las cuotas cuestan ${formatAmount(Math.abs(result.savingsVsCash))} más`}
                    </p>

                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {result.breakEvenInflationPercent <= 0
                        ? 'Ya conviene desde 0% de inflación mensual.'
                        : `Te conviene si la inflación supera el ${result.breakEvenInflationPercent}% mensual.`}
                    </p>

                    <button
                      onClick={() =>
                        convert({
                          description: description.trim() || 'Compra en cuotas',
                          totalAmount: result.totalNominal,
                          installmentsCount: result.installmentsCount,
                        })
                      }
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                    >
                      Convertir en Compra en Cuotas <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
