'use client'

import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useCategories } from '@/context/CategoriesContext'
import { parseAfipQrUrl } from '@/lib/afipQr'
import { QrCode, X, CheckCircle2, CameraOff } from 'lucide-react'

interface QrInvoiceScannerProps {
  isOpen: boolean
  onClose: () => void
  onTransactionAdded?: () => void
}

export default function QrInvoiceScanner({ isOpen, onClose, onTransactionAdded }: QrInvoiceScannerProps) {
  const { user } = useUser()
  const { categories } = useCategories()
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannedAmount, setScannedAmount] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function scanFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      const invoice = parseAfipQrUrl(code.data)
      if (invoice) {
        setScannedAmount(invoice.importe)
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
        streamRef.current?.getTracks().forEach((track) => track.stop())
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraError(null)

        scanIntervalRef.current = setInterval(() => {
          scanFrame()
        }, 400)
      } catch (err) {
        console.error('Error accediendo a la cámara:', err)
        setCameraError(
          'No se pudo acceder a la cámara. Revisá los permisos del navegador, o probá desde el celular.'
        )
      }
    }

    startCamera()

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [isOpen])

  function handleClose() {
    onClose()
    setScannedAmount(null)
    setDescription('')
    setCategoryId('')
    setCameraError(null)
  }

  async function handleSave() {
    if (scannedAmount === null || !description.trim()) return

    setSubmitting(true)
    if (!user) {
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        description: description.trim(),
        type: 'expense',
        category_id: categoryId || null,
        payment_method: 'Efectivo',
        is_usd: false,
        amount_usd: null,
        amount_ars: scannedAmount,
        exchange_rate: null,
      },
    ])

    if (!error) {
      handleClose()
      if (onTransactionAdded) onTransactionAdded()
    } else {
      alert('Error al guardar el movimiento: ' + error.message)
      console.error('Error guardando movimiento desde QR:', error)
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
                <QrCode size={16} className="text-cyan-600" /> Escanear factura
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[10px] text-gray-400">
              Funciona con el QR de facturas electrónicas AFIP — el QR ya trae el monto exacto
              codificado, no hace falta leer el ticket con la cámara.
            </p>

            {scannedAmount === null ? (
              cameraError ? (
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs font-semibold p-3 rounded-xl">
                  <CameraOff size={14} className="shrink-0" /> {cameraError}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-8 border-2 border-cyan-400 rounded-xl pointer-events-none" />
                </div>
              )
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-2.5 border border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Factura detectada — confirmá antes de guardar
                </p>
                <p className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                  $ {scannedAmount.toLocaleString('es-AR')}
                </p>

                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción (ej. Supermercado)"
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
                  disabled={submitting || !description.trim()}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
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
