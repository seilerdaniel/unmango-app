/**
 * Mapa de palabras clave típicas (comercios, rubros) a nombres de
 * categoría — los mismos nombres que usa `SUGGESTED_CATEGORIES`, para
 * poder cruzarlos con las categorías reales del usuario por nombre.
 * Pensado para Argentina: marcas y rubros comunes.
 */
const CATEGORY_KEYWORDS: { categoryName: string; keywords: string[] }[] = [
  { categoryName: 'Supermercado', keywords: ['coto', 'carrefour', 'dia', 'día', 'jumbo', 'super', 'supermercado', 'vea', 'disco', 'chino', 'almacen', 'almacén'] },
  { categoryName: 'Transporte', keywords: ['nafta', 'combustible', 'uber', 'cabify', 'taxi', 'sube', 'colectivo', 'subte', 'peaje', 'estacionamiento', 'ypf', 'shell', 'axion'] },
  { categoryName: 'Restaurantes y Delivery', keywords: ['pedidosya', 'rappi', 'restaurante', 'resto', 'bar', 'cafe', 'café', 'delivery', 'mcdonalds', 'burger', 'pizza', 'heladeria', 'heladería'] },
  { categoryName: 'Entretenimiento', keywords: ['netflix', 'spotify', 'cine', 'teatro', 'disney', 'hbo', 'streaming', 'youtube premium'] },
  { categoryName: 'Salud', keywords: ['farmacia', 'medico', 'médico', 'doctor', 'consulta', 'obra social', 'dentista', 'kinesiologo', 'kinesiólogo'] },
  { categoryName: 'Servicios', keywords: ['luz', 'gas', 'agua', 'internet', 'telefono', 'teléfono', 'wifi', 'edenor', 'edesur', 'metrogas'] },
  { categoryName: 'Ropa y Calzado', keywords: ['zapatillas', 'ropa', 'zara', 'nike', 'adidas', 'remera', 'pantalon', 'pantalón'] },
  { categoryName: 'Tecnología', keywords: ['apple', 'samsung', 'notebook', 'celular', 'auriculares', 'cargador', 'mercado libre'] },
  { categoryName: 'Mascotas', keywords: ['veterinaria', 'petshop', 'mascota', 'perro', 'gato', 'alimento balanceado'] },
  { categoryName: 'Educación', keywords: ['facultad', 'universidad', 'curso', 'colegio', 'escuela', 'libreria', 'librería'] },
]

/**
 * Adivina el nombre de categoría más probable a partir del texto (la
 * frase completa dicha por voz, o la descripción ya extraída) buscando
 * palabras clave de comercios/rubros comunes. Devuelve null si no
 * reconoce nada — nunca inventa una categoría al azar. El nombre
 * devuelto todavía hay que cruzarlo con las categorías reales del
 * usuario (puede que no tenga esa categoría creada).
 */
export function guessCategoryName(text: string): string | null {
  const lower = text.toLowerCase()
  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.categoryName
  }
  return null
}
