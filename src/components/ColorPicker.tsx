'use client'

import { PRESET_COLORS } from '@/lib/presetColors'
import { Check } from 'lucide-react'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

const presetValues: string[] = PRESET_COLORS.map((c) => c.value)

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isCustomColor = !presetValues.includes(value)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESET_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          onClick={() => onChange(color.value)}
          title={color.name}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 transition cursor-pointer"
          style={{
            backgroundColor: color.value,
            boxShadow: value === color.value ? `0 0 0 2px ${color.value}` : undefined,
          }}
        >
          {value === color.value && <Check size={14} className="text-white" strokeWidth={3} />}
        </button>
      ))}

      {/* Opción "Personalizado": el selector nativo del navegador, para
          cuando ninguna de las 7 pastillas sirve. */}
      <label
        title="Color personalizado"
        className="relative w-7 h-7 rounded-full shrink-0 cursor-pointer overflow-hidden"
        style={{
          background: isCustomColor ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
          boxShadow: isCustomColor ? `0 0 0 2px ${value}` : undefined,
        }}
      >
        <input
          type="color"
          value={isCustomColor ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        {isCustomColor && <Check size={14} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
      </label>
    </div>
  )
}
