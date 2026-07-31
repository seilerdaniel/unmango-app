'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { Wallet, WalletWithBalance } from '@/types'
import ColorPicker from '@/components/ColorPicker'
import { WalletIcon, Plus, Trash2, Landmark, Banknote, Smartphone, CreditCard, Pencil, X } from 'lucide-react'

const WALLET_TYPES: { value: Wallet['type']; label: string }[] = [
  { value: 'virtual_wallet', label: 'Billetera Virtual' },
  { value: 'bank', label: 'Banco' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'credit_card', label: 'Tarjeta de Crédito' },
  { value: 'debit_card', label: 'Tarjeta de Débito' },
  { value: 'other', label: 'Otra' },
]

const CARD_NETWORKS = ['Visa', 'Mastercard', 'American Express', 'Otra']

function walletIconFor(type: Wallet['type']) {
  switch (type) {
    case 'bank':
      return Landmark
    case 'cash':
      return Banknote
    case 'virtual_wallet':
      return Smartphone
    case 'credit_card':
    case 'debit_card':
      return CreditCard
    default:
      return WalletIcon
  }
}

export default function WalletManager({ onWalletsUpdated }: { onWalletsUpdated?: () => void }) {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([])
  const [name, setName] = useState('')
  const [type, setType] = useState<Wallet['type']>('virtual_wallet')
  const [color, setColor] = useState('#6366f1')
  const [initialBalance, setInitialBalance] = useState('')
  const [cardNetwork, setCardNetwork] = useState('Visa')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()
  const containerRef = useRef<HTMLDivElement>(null)

  async function loadWallets() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: walletsData, error: walletsError }, { data: balancesData, error: balancesError }] =
        await Promise.all([
          supabase.from('wallets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase.rpc('get_wallet_balances'),
        ])

      if (walletsError) throw walletsError
      if (balancesError) throw balancesError

      const balanceByWallet: Record<string, number> = {}
      for (const row of balancesData ?? []) {
        balanceByWallet[row.wallet_id] = Number(row.balance) || 0
      }

      const combined: WalletWithBalance[] = (walletsData ?? []).map((w) => ({
        ...w,
        balance: balanceByWallet[w.id] ?? (Number(w.initial_balance) || 0),
      }))

      setWallets(combined)
      setLoadError(null)
    } catch (err) {
      console.error('Error cargando billeteras:', err)
      setLoadError('No se pudieron cargar las billeteras. Reintentá más tarde.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadWallets()
  }, [])

  function resetForm() {
    setName('')
    setType('virtual_wallet')
    setColor('#6366f1')
    setInitialBalance('')
    setCardNetwork('Visa')
    setEditingId(null)
  }

  function startEditing(w: WalletWithBalance) {
    setEditingId(w.id)
    setName(w.name)
    setType(w.type)
    setColor(w.color || '#6366f1')
    setInitialBalance(String(w.initial_balance ?? ''))
    setCardNetwork(w.card_network || 'Visa')
    if (typeof window !== 'undefined') containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const isCard = type === 'credit_card' || type === 'debit_card'
      const payload = {
        name: name.trim(),
        type,
        color,
        initial_balance: Number(initialBalance) || 0,
        card_network: isCard ? cardNetwork : null,
      }

      const { error } = editingId
        ? await supabase.from('wallets').update(payload).eq('id', editingId)
        : await supabase.from('wallets').insert([{ ...payload, user_id: user.id }])

      if (!error) {
        resetForm()
        await loadWallets()
        if (onWalletsUpdated) onWalletsUpdated()
      } else {
        alert(`Error al ${editingId ? 'editar' : 'crear'} la billetera: ` + error.message)
        console.error(`Error ${editingId ? 'editando' : 'creando'} billetera:`, error)
      }
    }
    setSubmitting(false)
  }

  async function handleDeleteWallet(id: string) {
    if (
      confirm(
        '¿Eliminar esta billetera? Los movimientos que tenía asignados van a quedar sin billetera, no se borran.'
      )
    ) {
      const { error } = await supabase.from('wallets').delete().eq('id', id)
      if (!error) {
        if (editingId === id) resetForm()
        await loadWallets()
        if (onWalletsUpdated) onWalletsUpdated()
      } else {
        alert('Error al eliminar la billetera: ' + error.message)
        console.error('Error eliminando billetera:', error)
      }
    }
  }

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando billeteras...</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <WalletIcon className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mis Billeteras</h2>
        </div>
        {wallets.length > 0 && (
          <div className="text-right">
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Total</span>
            <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
              {isPrivate ? '••••••' : formatAmount(totalBalance)}
            </span>
          </div>
        )}
      </div>

      {loadError && (
        <p className="text-xs font-semibold text-rose-600">{loadError}</p>
      )}

      {editingId && (
        <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-3.5 py-2 rounded-xl">
          <span className="truncate min-w-0">Editando &quot;{name}&quot;</span>
          <button onClick={resetForm} className="flex items-center gap-1 hover:underline cursor-pointer shrink-0">
            <X size={12} /> Cancelar
          </button>
        </div>
      )}

      {/* Formulario de alta / edición */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <input
          type="text"
          placeholder="Nombre"
          title="Ej: Mercado Pago"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value as Wallet['type'])}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {WALLET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Saldo inicial"
          title="Cuánto tenés hoy en esta cuenta/billetera, para arrancar el conteo desde ahí (dejalo vacío si arranca en $0)"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {(type === 'credit_card' || type === 'debit_card') && (
          <select
            value={cardNetwork}
            onChange={(e) => setCardNetwork(e.target.value)}
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CARD_NETWORKS.map((network) => (
              <option key={network} value={network}>
                {network}
              </option>
            ))}
          </select>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar'}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0">Color:</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">
        ¿Tenés varias tarjetas? Cargá cada una por separado con “Tarjeta de Crédito” o “Tarjeta de
        Débito” — no hay límite, y podés ponerle un nombre distinto a cada una (ej. “Visa Galicia”,
        “Mastercard Naranja X”) para distinguirlas.
      </p>

      {/* Lista de billeteras */}
      {wallets.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          Todavía no creaste ninguna billetera. Agregá una para empezar a ver tu saldo por cuenta.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {wallets.map((w) => {
            const Icon = walletIconFor(w.type)
            return (
              <div
                key={w.id}
                className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-xl shrink-0"
                    style={{ backgroundColor: `${w.color || '#6366f1'}18`, color: w.color || '#6366f1' }}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate" title={w.name}>
                      {w.name}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {WALLET_TYPES.find((t) => t.value === w.type)?.label ?? 'Otra'}
                      {w.card_network ? ` · ${w.card_network}` : ''}
                    </p>
                  </div>
                </div>

                {/* Saldo en su propia línea, alineado bajo el nombre — así
                    nunca se aprieta contra el nombre en cards angostas. */}
                <div className="flex items-center justify-between pl-[44px]">
                  <span
                    className={`text-sm font-extrabold ${w.balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-rose-600'}`}
                  >
                    {isPrivate ? '••••••' : formatAmount(w.balance)}
                  </span>
                  <button
                    onClick={() => startEditing(w)}
                    className="text-gray-400 hover:text-indigo-600 transition p-1 cursor-pointer"
                    title="Editar billetera"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteWallet(w.id)}
                    className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Eliminar billetera"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
