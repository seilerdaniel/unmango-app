'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCategories } from '@/context/CategoriesContext'
import ColorPicker from '@/components/ColorPicker'
import IconPicker from '@/components/IconPicker'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { SUGGESTED_CATEGORIES } from '@/lib/suggestedCategories'
import { Tag, Plus, Trash2, Sparkles } from 'lucide-react'

interface CategoryManagerProps {
  onCategoriesUpdated?: () => void
}

export default function CategoryManager({ onCategoriesUpdated }: CategoryManagerProps) {
  const { categories, loading: categoriesLoading, error: categoriesError, refreshCategories } = useCategories()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#f59e0b')
  const [icon, setIcon] = useState('tag')
  const [submitting, setSubmitting] = useState(false)
  const [loadingSuggested, setLoadingSuggested] = useState(false)

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error } = await supabase.from('categories').insert([
        {
          user_id: user.id,
          name: name.trim(),
          color,
          icon,
        },
      ])

      if (!error) {
        setName('')
        await refreshCategories()
        if (onCategoriesUpdated) onCategoriesUpdated()
      } else {
        alert('Error al crear categoría: ' + error.message)
      }
    }
    setSubmitting(false)
  }

  async function handleDeleteCategory(id: string) {
    if (confirm('¿Quieres eliminar esta categoría?')) {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (!error) {
        await refreshCategories()
        if (onCategoriesUpdated) onCategoriesUpdated()
      } else {
        alert('Error al eliminar la categoría: ' + error.message)
        console.error('Error eliminando categoría:', error)
      }
    }
  }

  async function handleAddSuggested() {
    setLoadingSuggested(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadingSuggested(false)
      return
    }

    // No duplicamos las que ya existen (comparando por nombre, sin
    // importar mayúsculas/minúsculas).
    const existingNames = new Set(categories.map((c) => c.name.trim().toLowerCase()))
    const toInsert = SUGGESTED_CATEGORIES.filter((c) => !existingNames.has(c.name.toLowerCase())).map((c) => ({
      user_id: user.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
    }))

    if (toInsert.length === 0) {
      alert('Ya tenés todas las categorías sugeridas cargadas.')
      setLoadingSuggested(false)
      return
    }

    const { error } = await supabase.from('categories').insert(toInsert)
    if (!error) {
      await refreshCategories()
      if (onCategoriesUpdated) onCategoriesUpdated()
    } else {
      alert('Error al cargar las categorías sugeridas: ' + error.message)
      console.error('Error cargando categorías sugeridas:', error)
    }
    setLoadingSuggested(false)
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Tag className="text-amber-500" size={18} /> Mis Categorías
        </h3>
        <button
          onClick={handleAddSuggested}
          disabled={loadingSuggested}
          title="Agrega 15 categorías típicas para empezar rápido"
          className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50 cursor-pointer"
        >
          <Sparkles size={12} /> {loadingSuggested ? 'Cargando...' : 'Sugeridas'}
        </button>
      </div>

      {categoriesError && (
        <p className="text-xs font-semibold text-rose-600">{categoriesError}</p>
      )}

      {/* Formulario Nueva Categoría */}
      <form onSubmit={handleAddCategory} className="space-y-2.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva categoría"
            title="Ej: Salidas"
            required
            className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 !text-gray-900 dark:!text-gray-100 font-semibold text-xs placeholder:!text-gray-400 dark:placeholder:!text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Plus size={16} /> Crear
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0">Color:</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0">Ícono:</span>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>
      </form>

      {/* Lista de Categorías */}
      <div className="flex flex-wrap gap-2 pt-2">
        {categoriesLoading ? (
          <p className="text-xs text-gray-400 animate-pulse">Cargando categorías...</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-gray-400">
            Aún no creaste categorías personalizadas. Probá el botón &quot;Sugeridas&quot; de arriba
            para empezar rápido.
          </p>
        ) : (
          categories.map((cat) => {
            const CatIcon = getCategoryIcon(cat.icon)
            return (
              <div
                key={cat.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 dark:border-gray-700 shadow-xs"
                style={{ backgroundColor: `${cat.color || '#94a3b8'}15`, color: cat.color || '#94a3b8' }}
              >
                <CatIcon size={13} />
                {cat.name}
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="hover:text-rose-600 transition ml-1"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
