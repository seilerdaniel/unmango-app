'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCategories } from '@/context/CategoriesContext'
import { Tag, Plus, Trash2 } from 'lucide-react'

interface CategoryManagerProps {
  onCategoriesUpdated?: () => void
}

export default function CategoryManager({ onCategoriesUpdated }: CategoryManagerProps) {
  const { categories, loading: categoriesLoading, error: categoriesError, refreshCategories } = useCategories()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#f59e0b')
  const [submitting, setSubmitting] = useState(false)

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
          color: color,
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

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
        <Tag className="text-amber-500" size={18} /> Mis Categorías
      </h3>

      {categoriesError && (
        <p className="text-xs font-semibold text-rose-600">{categoriesError}</p>
      )}

      {/* Formulario Nueva Categoría */}
      <form onSubmit={handleAddCategory} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva categoría (ej: Salidas)"
          required
          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-300 bg-white !text-gray-900 font-semibold text-xs placeholder:!text-gray-400 outline-none focus:ring-2 focus:ring-amber-500/50"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-9 p-1 bg-white rounded-xl border border-gray-300 cursor-pointer"
          title="Elegir color"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-2 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
        >
          <Plus size={16} /> Crear
        </button>
      </form>

      {/* Lista de Categorías */}
      <div className="flex flex-wrap gap-2 pt-2">
        {categoriesLoading ? (
          <p className="text-xs text-gray-400 animate-pulse">Cargando categorías...</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-gray-400">Aún no creaste categorías personalizadas.</p>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-100 shadow-xs"
              style={{ backgroundColor: `${cat.color || '#94a3b8'}15`, color: cat.color || '#94a3b8' }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color || '#94a3b8' }} />
              {cat.name}
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="hover:text-rose-600 transition ml-1"
                title="Eliminar"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
