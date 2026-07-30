'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCategories } from '@/context/CategoriesContext'
import { parseNaturalLanguageExpense } from '@/lib/naturalLanguageExpense'
import { Mic, MicOff, X, CheckCircle2 } from 'lucide-react'

// El navegador tipa esto de forma no estándar todavía (prefijo webkit en
// Chrome/Edge). Se declara mínimamente lo que se usa, sin depender de
// @types/dom-speech-recognition para no sumar una dependencia solo por
// esto.
interface MinimalSpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: { transcript: string }[][] } & Event) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => MinimalSpeechRecognition) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => MinimalSpeechRecognition
    webkitSpeechRecognition?: new () => MinimalSpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface VoiceExpenseInputProps {
  isOpen: boolean
  onClose: () => void
  onTransactionAdded?: () => void
}

export default function VoiceExpenseInput({ isOpen, onClose, onTransactionAdded }: VoiceExpenseInputProps) {
  const { categories } = useCategories()
  const [isListening, setIsListening] = useState(false)
  const [rawText, setRawText] = useState('')
  const [supported, setSupported] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Campos editables de confirmación — se pre-llenan con lo que se
  // entendió, pero SIEMPRE hay que confirmar antes de guardar (nunca se
  // guarda directo desde el reconocimiento de voz, que puede
  // equivocarse).
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState('')

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null)

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null)
  }, [])

  function handleTranscript(text: string) {
    setRawText(text)
    const parsed = parseNaturalLanguageExpense(text)
    if (parsed.amount !== null) setAmount(String(parsed.amount))
    if (parsed.description !== null) setDescription(parsed.description)
    setType(parsed.type)
  }

  function startListening() {
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'es-AR'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      handleTranscript(transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0 || !description.trim()) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        description: description.trim(),
        type,
        category_id: categoryId || null,
        payment_method: 'Efectivo',
        is_usd: false,
        amount_usd: null,
        amount_ars: Number(amount),
        exchange_rate: null,
      },
    ])

    if (!error) {
      onClose()
      setRawText('')
      setAmount('')
      setDescription('')
      setCategoryId('')
      if (onTransactionAdded) onTransactionAdded()
    } else {
      alert('Error al guardar el movimiento: ' + error.message)
      console.error('Error guardando movimiento por voz:', error)
    }
    setSubmitting(false)
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Mic size={16} className="text-rose-600" /> Cargar por voz
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {!supported && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Tu navegador no soporta reconocimiento de voz — funciona en Chrome/Edge de
                escritorio y Android. Igual podés escribir la frase abajo a mano.
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={rawText}
                onChange={(e) => handleTranscript(e.target.value)}
                placeholder="Ej: Gasté 8500 en Coto con tarjeta"
                className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
              />
              {supported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`shrink-0 p-2.5 rounded-xl transition cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                  title={isListening ? 'Escuchando... tocá para parar' : 'Hablar'}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>

            {rawText && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-2.5 border border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Confirmá antes de guardar
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Monto"
                    className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 font-semibold text-gray-800 dark:text-gray-200"
                  />
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                    className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 font-semibold text-gray-800 dark:text-gray-200"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción"
                  className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 font-semibold text-gray-800 dark:text-gray-200"
                />

                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-2 font-semibold text-gray-800 dark:text-gray-200"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSave}
                  disabled={submitting || !amount || !description.trim()}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> {submitting ? 'Guardando...' : 'Confirmar y guardar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
