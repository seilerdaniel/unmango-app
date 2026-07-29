'use client'

import { CATEGORY_ICONS } from '@/lib/categoryIcons'

interface IconPickerProps {
  value: string | null
  onChange: (icon: string) => void
}

export default function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap max-w-xs">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          title={name}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition cursor-pointer ${
            value === name
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
