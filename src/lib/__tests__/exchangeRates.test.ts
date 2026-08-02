import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseExchangeRates,
  convertUsdToArs,
  convertArsToUsd,
  fetchExchangeRates,
  readExchangeRatesCache,
  writeExchangeRatesCache,
  clearExchangeRatesMemoryCache,
  quoteSell,
  EXCHANGE_RATES_TTL_MS,
  EXCHANGE_RATES_CACHE_KEY,
} from '../exchangeRates'

function makeFetcher(payload: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch
}

const API_PAYLOAD = [
  { moneda: 'USD', casa: 'oficial', nombre: 'Oficial', compra: 1000, venta: 1020, fechaActualizacion: '2026-08-01T10:00:00Z' },
  { moneda: 'USD', casa: 'blue', nombre: 'Blue', compra: 1550, venta: 1560, fechaActualizacion: '2026-08-01T10:00:00Z' },
  { moneda: 'USD', casa: 'bolsa', nombre: 'MEP', compra: 1440, venta: 1450, fechaActualizacion: '2026-08-01T10:00:00Z' },
  { moneda: 'USD', casa: 'contadoconliqui', nombre: 'CCL', compra: 1490, venta: 1500, fechaActualizacion: '2026-08-01T10:00:00Z' },
  { moneda: 'USD', casa: 'tarjeta', nombre: 'Tarjeta', compra: 1600, venta: 1700, fechaActualizacion: '2026-08-01T10:00:00Z' },
]

describe('exchangeRates', () => {
  beforeEach(() => {
    clearExchangeRatesMemoryCache()
    localStorage.clear()
  })

  it('parseExchangeRates mapea oficial/blue/MEP/CCL e ignora el resto', () => {
    const rates = parseExchangeRates(API_PAYLOAD)
    expect(rates).toHaveLength(4)
    expect(rates.map((r) => r.casa)).toEqual(['oficial', 'blue', 'mep', 'ccl'])
    expect(rates.find((r) => r.casa === 'mep')?.sell).toBe(1450)
    expect(rates.find((r) => r.casa === 'ccl')?.name).toBe('Dólar CCL')
    expect(rates.find((r) => r.casa === 'blue')?.buy).toBe(1550)
  })

  it('parseExchangeRates tolera payloads vacíos o malformados', () => {
    expect(parseExchangeRates(null)).toEqual([])
    expect(parseExchangeRates('nope')).toEqual([])
    expect(parseExchangeRates([{}, { casa: 'blue', venta: null }])).toEqual([])
  })

  it('convierte ARS ⇄ USD con la cotización dada', () => {
    expect(convertUsdToArs(100, 1450)).toBe(145000)
    expect(convertArsToUsd(145000, 1450)).toBe(100)
    expect(convertUsdToArs(100.005, 1)).toBe(100.01)
  })

  it('convertArsToUsd devuelve el monto si la cotización no es válida', () => {
    expect(convertArsToUsd(145000, 0)).toBe(145000)
    expect(convertArsToUsd(145000, -5)).toBe(145000)
  })

  it('quoteSell devuelve la venta de la casa pedida o null', () => {
    const rates = parseExchangeRates(API_PAYLOAD)
    expect(quoteSell(rates, 'mep')).toBe(1450)
    expect(quoteSell(rates, 'blue')).toBe(1560)
    expect(quoteSell([], 'mep')).toBe(null)
  })

  it('fetchExchangeRates trae de la red, cachea en memoria y no vuelve a pedir', async () => {
    const fetcher = makeFetcher(API_PAYLOAD)
    const now = Date.now()

    const first = await fetchExchangeRates({ fetcher, now })
    expect(first).toHaveLength(4)
    expect(fetcher).toHaveBeenCalledTimes(1)

    const second = await fetchExchangeRates({ fetcher, now: now + 60_000 })
    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fetchExchangeRates usa la caché fresca de localStorage sin tocar la red', async () => {
    const rates = parseExchangeRates(API_PAYLOAD)
    writeExchangeRatesCache(rates, Date.now())
    clearExchangeRatesMemoryCache()

    const fetcher = makeFetcher(API_PAYLOAD)
    const result = await fetchExchangeRates({ fetcher })
    expect(result).toHaveLength(4)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('fetchExchangeRates vuelve a la red cuando la caché está vencida', async () => {
    writeExchangeRatesCache(parseExchangeRates(API_PAYLOAD), Date.now() - EXCHANGE_RATES_TTL_MS - 1)
    clearExchangeRatesMemoryCache()

    const fetcher = makeFetcher(API_PAYLOAD)
    const now = Date.now()
    const result = await fetchExchangeRates({ fetcher, now })
    expect(result).toHaveLength(4)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fetchExchangeRates cae a la caché vencida cuando la red falla (offline)', async () => {
    const rates = parseExchangeRates(API_PAYLOAD)
    writeExchangeRatesCache(rates, Date.now() - EXCHANGE_RATES_TTL_MS - 1000)
    clearExchangeRatesMemoryCache()

    const fetcher = makeFetcher(null, false)
    const result = await fetchExchangeRates({ fetcher })
    expect(result).toEqual(rates)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fetchExchangeRates rechaza si falla la red y no hay caché', async () => {
    const fetcher = makeFetcher(null, false)
    await expect(fetchExchangeRates({ fetcher })).rejects.toThrow()
  })

  it('readExchangeRatesCache respeta el TTL y allowStale', () => {
    const rates = parseExchangeRates(API_PAYLOAD)
    const now = Date.now()
    writeExchangeRatesCache(rates, now)
    clearExchangeRatesMemoryCache()

    expect(readExchangeRatesCache(now)).toHaveLength(4)
    expect(readExchangeRatesCache(now + EXCHANGE_RATES_TTL_MS + 1)).toBeNull()
    expect(readExchangeRatesCache(now + EXCHANGE_RATES_TTL_MS + 1, true)).toHaveLength(4)

    // Y la caché fresca también es visible por la key esperada.
    expect(localStorage.getItem(EXCHANGE_RATES_CACHE_KEY)).not.toBeNull()
  })
})
