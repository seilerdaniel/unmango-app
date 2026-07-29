/**
 * Paleta de colores predefinidos para billeteras y categorías. La idea
 * es que elegir un color sea un click sobre una pastilla, no tener que
 * abrir el selector nativo del navegador cada vez — pero ese selector
 * libre sigue disponible como una opción más ("Personalizado") para
 * quien quiera un color exacto.
 */
export const PRESET_COLORS = [
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Cian', value: '#06b6d4' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Rojo', value: '#ef4444' },
] as const
