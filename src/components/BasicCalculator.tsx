'use client'

import { useState } from 'react'
import { applyOperator, CalculatorOperator } from '@/lib/basicCalculator'
import { Calculator as CalculatorIcon, X } from 'lucide-react'

export default function BasicCalculator() {
  const [isOpen, setIsOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [pendingOperator, setPendingOperator] = useState<CalculatorOperator | null>(null)
  const [resetOnNextDigit, setResetOnNextDigit] = useState(false)

  function handleDigit(digit: string) {
    if (display === '0' || resetOnNextDigit) {
      setDisplay(digit)
      setResetOnNextDigit(false)
    } else {
      setDisplay(display + digit)
    }
  }

  function handleDecimal() {
    if (resetOnNextDigit) {
      setDisplay('0.')
      setResetOnNextDigit(false)
      return
    }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  function handleOperator(operator: CalculatorOperator) {
    const current = Number(display)

    if (previousValue !== null && pendingOperator && !resetOnNextDigit) {
      const result = applyOperator(previousValue, current, pendingOperator)
      setDisplay(String(result))
      setPreviousValue(result)
    } else {
      setPreviousValue(current)
    }

    setPendingOperator(operator)
    setResetOnNextDigit(true)
  }

  function handleEquals() {
    if (previousValue === null || !pendingOperator) return
    const current = Number(display)
    const result = applyOperator(previousValue, current, pendingOperator)
    setDisplay(String(result))
    setPreviousValue(null)
    setPendingOperator(null)
    setResetOnNextDigit(true)
  }

  function handleClear() {
    setDisplay('0')
    setPreviousValue(null)
    setPendingOperator(null)
    setResetOnNextDigit(false)
  }

  function handleToggleSign() {
    if (display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`)
  }

  const buttonClass =
    'h-11 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center'

  return (
    <>
      {/* Botón flotante — apilado arriba del de ARS/USD Blue, con
          ícono/color distintos para que se distingan de un vistazo. */}
      <button
        onClick={() => setIsOpen(true)}
        title="Calculadora"
        className="fixed bottom-20 right-5 z-40 bg-slate-700 hover:bg-slate-800 text-white p-3.5 rounded-full shadow-lg shadow-slate-700/30 transition cursor-pointer"
      >
        <CalculatorIcon size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CalculatorIcon size={16} className="text-slate-600 dark:text-slate-400" /> Calculadora
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-right">
              <p data-testid="calculator-display" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 truncate">
                {display}
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={handleClear}
                className={`${buttonClass} bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 col-span-2`}
              >
                C
              </button>
              <button
                onClick={handleToggleSign}
                className={`${buttonClass} bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300`}
              >
                +/-
              </button>
              <button
                onClick={() => handleOperator('÷')}
                className={`${buttonClass} bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400`}
              >
                ÷
              </button>

              {['7', '8', '9'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className={`${buttonClass} bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200`}
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => handleOperator('×')}
                className={`${buttonClass} bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400`}
              >
                ×
              </button>

              {['4', '5', '6'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className={`${buttonClass} bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200`}
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => handleOperator('-')}
                className={`${buttonClass} bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400`}
              >
                -
              </button>

              {['1', '2', '3'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className={`${buttonClass} bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200`}
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => handleOperator('+')}
                className={`${buttonClass} bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400`}
              >
                +
              </button>

              <button
                onClick={() => handleDigit('0')}
                className={`${buttonClass} bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 col-span-2`}
              >
                0
              </button>
              <button
                onClick={handleDecimal}
                className={`${buttonClass} bg-gray-50 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200`}
              >
                ,
              </button>
              <button onClick={handleEquals} className={`${buttonClass} bg-slate-700 hover:bg-slate-800 text-white`}>
                =
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
