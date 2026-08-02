import { round2 } from './money'

/**
 * Cotizaciones del dólar en Argentina, con caché de 15 minutos en
 * memoria + localStorage y fallback offline.
 *
 * Fuente: dolarapi.com (pública, sin API key). Responde en
 * GET /v1/dolares un array con `casa` ('oficial' | 'blue' | 'bolsa' |
 * 'contadoconliqui' | 'tarjeta' | ...), `compra`, `venta` y
 * `fechaActualizacion`. Acá mapeamos las 4 cotizaciones que usa la app:
 * Oficial, Blue, MEP (bolsa) y CCL (contadoconliqui).
 *
 * El resto de la app usaba fetch() directo a dolarapi en cada
 * componente (DolarWidget, DollarRatesTable, ArsUsdCalculator,
 * ExchangeGapSimulator), cada uno con su propio formato. Este es el
 * lugar canónico: un solo fetch, cacheado, con funciones de conversión
 * puras y testables.
 */

export type ExchangeRateCasa = 'oficial' | 'blue' | 'mep' | 'ccl'

export interface ExchangeRateQuote {
  casa: ExchangeRateCasa
  name: string
  buy: number
  sell: number
  updatedAt: string | null
}

/** Formato real de cada ítem de GET /v1/dolares (campos opcionales por robustez). */
export interface RawDolarApiQuote {
  moneda?: string
  casa?: string
  nombre?: string
  compra?: number | null
  venta?: number | null
  fechaActualizacion?: string | null
}

export const EXCHANGE_RATES_CACHE_KEY = 'unmango_exchange_rates'
export const EXCHANGE_RATES_TTL_MS = 15 * 60 * 1000

/** casa que devuelve dolarapi → casa canónica de la app. */
const CASA_MAP: Record<string, ExchangeRateCasa> = {
  oficial: 'oficial',
  blue: 'blue',
  bolsa: 'mep',
  contadoconliqui: 'ccl',
}

const NAME_BY_CASA: Record<ExchangeRateCasa, string> = {
  oficial: 'Dólar Oficial',
  blue: 'Dólar Blue',
  mep: 'Dólar MEP',
  ccl: 'Dólar CCL',
}

/** Convierte un monto en dólares a pesos usando la cotización dada. */
export function convertUsdToArs(amountUsd: number, rate: number): number {
  return round2(amountUsd * rate)
}

/** Convierte un monto en pesos a dólares usando la cotización dada. */
export function convertArsToUsd(amountArs: number, rate: number): number {
  if (!(rate > 0)) return amountArs
  return round2(amountArs / rate)
}

/**
 * Parsea la respuesta cruda de GET /v1/dolares y devuelve solo las 4
 * cotizaciones que la app usa (Oficial, Blue, MEP, CCL), ignorando el
 * resto (tarjeta, mayorista, cripto, ...). Función pura y testeable.
 */
export function parseExchangeRates(payload: unknown): ExchangeRateQuote[] {
  if (!Array.isArray(payload)) return []

  const quotes: ExchangeRateQuote[] = []
  for (const item of payload) {
    if (!item || typeof item !== 'object') continue
    const raw = item as RawDolarApiQuote
    const casa = CASA_MAP[raw.casa ?? '']
    if (!casa) continue

    const buy = Number(raw.compra)
    const sell = Number(raw.venta)
    const buyValue = Number.isFinite(buy) ? buy : 0
    const sellValue = Number.isFinite(sell) ? sell : 0

    if (buyValue <= 0 && sellValue <= 0) continue

    quotes.push({
      casa,
      name: NAME_BY_CASA[casa],
      buy: buyValue,
      sell: sellValue,
      updatedAt: raw.fechaActualizacion ?? null,
    })
  }

  return quotes
}

interface CachedRates {
  rates: ExchangeRateQuote[]
  fetchedAt: number
}

let memoryCache: CachedRates | null = null

function isFresh(cache: CachedRates, now: number): boolean {
  return now - cache.fetchedAt <= EXCHANGE_RATES_TTL_MS
}

function readLocalCache(now: number, allowStale: boolean): ExchangeRateQuote[] | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(EXCHANGE_RATES_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    if (!Array.isArray(parsed.rates) || typeof parsed.fetchedAt !== 'number') return null
    if (!allowStale && !isFresh(parsed, now)) return null
    return parsed.rates
  } catch {
    return null
  }
}

/** Borra la caché en memoria (usado por los tests entre casos). */
export function clearExchangeRatesMemoryCache(): void {
  memoryCache = null
}

/**
 * Lee la caché en localStorage si está fresca (≤ 15 min). Si está
 * vencida y `allowStale` es true, la devuelve igual (fallback offline).
 */
export function readExchangeRatesCache(now: number = Date.now(), allowStale = false): ExchangeRateQuote[] | null {
  return readLocalCache(now, allowStale)
}

/** Persiste las cotizaciones en memoria + localStorage. */
export function writeExchangeRatesCache(rates: ExchangeRateQuote[], now: number = Date.now()): void {
  const payload: CachedRates = { rates, fetchedAt: now }
  memoryCache = payload
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(EXCHANGE_RATES_CACHE_KEY, JSON.stringify(payload))
    } catch {
      // localStorage lleno/bloqueado: la caché en memoria alcanza.
    }
  }
}

export interface FetchExchangeRatesOptions {
  /** Fetch a usar; inyectable en tests. Default: fetch global. */
  fetcher?: typeof fetch
  /** Timestamp en ms; inyectable en tests para simular el paso del tiempo. */
  now?: number
}

/**
 * Devuelve las cotizaciones con esta prioridad:
 * 1. Caché en memoria fresca (≤ 15 min).
 * 2. Caché en localStorage fresca.
 * 3. Red (dolarapi.com); si responde bien, cachea.
 * 4. Fallback offline: caché en localStorage vencida (o memoria).
 * 5. Si no hay nada, lanza el error de red.
 */
export async function fetchExchangeRates(options: FetchExchangeRatesOptions = {}): Promise<ExchangeRateQuote[]> {
  const now = options.now ?? Date.now()
  const fetcher = options.fetcher ?? globalThis.fetch

  if (memoryCache && isFresh(memoryCache, now)) {
    return memoryCache.rates
  }

  const localFresh = readLocalCache(now, false)
  if (localFresh) {
    memoryCache = { rates: localFresh, fetchedAt: now }
    return localFresh
  }

  try {
    const res = await fetcher('https://dolarapi.com/v1/dolares')
    if (!res.ok) throw new Error(`dolarapi respondió HTTP ${res.status}`)
    const payload: unknown = await res.json()
    const rates = parseExchangeRates(payload)
    if (rates.length === 0) throw new Error('dolarapi no devolvió cotizaciones')
    writeExchangeRatesCache(rates, now)
    return rates
  } catch (err) {
    const staleLocal = readLocalCache(now, true)
    if (staleLocal) {
      memoryCache = { rates: staleLocal, fetchedAt: now }
      return staleLocal
    }
    if (memoryCache) return memoryCache.rates
    throw err
  }
}

/** Busca una cotización puntual (default: la de venta de MEP). */
export function quoteSell(rates: ExchangeRateQuote[], casa: ExchangeRateCasa): number | null {
  const quote = rates.find((r) => r.casa === casa)
  return quote && quote.sell > 0 ? quote.sell : null
}
