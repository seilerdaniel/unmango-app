import { describe, it, expect, vi } from 'vitest'
import {
  chunk,
  generateId,
  insertBatches,
  remapForeignKey,
  buildCategoryInsertRows,
  buildWalletInsertRows,
  buildTransactionInsertRows,
  buildBudgetInsertRows,
  buildRecurringInsertRows,
  buildGoalInsertRows,
} from '../backupRestore'

describe('remapForeignKey', () => {
  it('traduce un id viejo al nuevo id según el mapa', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey('old-1', map)).toBe('new-1')
  })

  it('devuelve null si el id no está en el mapa (no rompe el insert)', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey('old-2', map)).toBeNull()
  })

  it('devuelve null si el id original es null', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey(null, map)).toBeNull()
  })

  it('devuelve null si el id original no es un string (ej. undefined)', () => {
    const map = new Map([['old-1', 'new-1']])
    expect(remapForeignKey(undefined, map)).toBeNull()
  })
})

describe('chunk', () => {
  it('parte un array en lotes del tamaño indicado', () => {
    const items = [1, 2, 3, 4, 5, 6, 7]
    expect(chunk(items, 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
  })

  it('devuelve un solo lote si el array entra en el tamaño', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]])
  })

  it('devuelve un lote por elemento con size 1', () => {
    expect(chunk(['a', 'b'], 1)).toEqual([['a'], ['b']])
  })

  it('devuelve [] para un array vacío', () => {
    expect(chunk([], 100)).toEqual([])
  })

  it('lanza si el tamaño no es mayor a 0', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})

describe('generateId', () => {
  it('genera un string no vacío', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(0)
  })
})

describe('buildCategoryInsertRows', () => {
  it('genera ids nuevos, setea user_id y arma el mapa viejo->nuevo', () => {
    const { rows, idMap } = buildCategoryInsertRows(
      [
        { id: 'cat-1', name: 'Comida', color: '#ef4444' },
        { id: 'cat-2', name: 'Transporte', color: '#3b82f6' },
      ],
      'user-1'
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: 'Comida', color: '#ef4444', user_id: 'user-1' })
    expect(rows[1]).toMatchObject({ name: 'Transporte', color: '#3b82f6', user_id: 'user-1' })
    // el id original no queda en la fila, y cada fila tiene un id nuevo distinto
    expect('id' in rows[0]! && 'id' in rows[1]!).toBe(true)
    expect(rows[0].id).toBeDefined()
    expect(rows[1].id).toBeDefined()
    expect(rows[0].id).not.toBe(rows[1].id)
    expect(idMap.get('cat-1')).toBe(rows[0].id)
    expect(idMap.get('cat-2')).toBe(rows[1].id)
  })

  it('ignora registros sin id de string (no entran al mapa)', () => {
    const { idMap } = buildCategoryInsertRows([{ id: 123, name: 'Rara' }], 'user-1')
    expect(idMap.size).toBe(0)
  })
})

describe('buildWalletInsertRows', () => {
  it('genera ids nuevos y arma el mapa viejo->nuevo', () => {
    const { rows, idMap } = buildWalletInsertRows([{ id: 'w-1', name: 'Mercado Pago' }], 'user-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Mercado Pago', user_id: 'user-1' })
    expect(idMap.get('w-1')).toBe(rows[0].id)
  })
})

describe('buildTransactionInsertRows', () => {
  const categoryMap = new Map([['cat-1', 'cat-new']])
  const walletMap = new Map([['w-1', 'wallet-new']])

  it('remapea category_id y wallet_id y quita los campos internos', () => {
    const rows = buildTransactionInsertRows(
      [{ id: 'tx-1', user_id: 'otro', category_id: 'cat-1', wallet_id: 'w-1', description: 'Café', amount_ars: 500 }],
      'user-1',
      categoryMap,
      walletMap
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      user_id: 'user-1',
      category_id: 'cat-new',
      wallet_id: 'wallet-new',
      description: 'Café',
      amount_ars: 500,
    })
    expect('id' in rows[0]!).toBe(false)
  })

  it('deja null si el FK no se puede remapear (no rompe el insert)', () => {
    const rows = buildTransactionInsertRows(
      [{ category_id: 'cat-inexistente', wallet_id: 'w-inexistente', description: 'X' }],
      'user-1',
      categoryMap,
      walletMap
    )
    expect(rows[0].category_id).toBeNull()
    expect(rows[0].wallet_id).toBeNull()
  })
})

describe('buildBudgetInsertRows', () => {
  it('remapea category_id y filtra los que no tienen categoría restaurada', () => {
    const categoryMap = new Map([['cat-1', 'cat-new']])
    const rows = buildBudgetInsertRows(
      [
        { id: 'b-1', category_id: 'cat-1', monthly_limit: 1000 },
        { id: 'b-2', category_id: 'cat-perdida', monthly_limit: 2000 },
      ],
      'user-1',
      categoryMap
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ category_id: 'cat-new', monthly_limit: 1000, user_id: 'user-1' })
  })
})

describe('buildRecurringInsertRows', () => {
  it('remapea category_id Y wallet_id (regresión: wallet_id no se remapeaba)', () => {
    const categoryMap = new Map([['cat-1', 'cat-new']])
    const walletMap = new Map([['w-1', 'wallet-new']])
    const rows = buildRecurringInsertRows(
      [{ id: 'r-1', category_id: 'cat-1', wallet_id: 'w-1', title: 'Netflix', amount: 5000 }],
      'user-1',
      categoryMap,
      walletMap
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      category_id: 'cat-new',
      wallet_id: 'wallet-new',
      title: 'Netflix',
      user_id: 'user-1',
    })
  })
})

describe('buildGoalInsertRows', () => {
  it('setea user_id y quita id/user_id viejos', () => {
    const rows = buildGoalInsertRows([{ id: 'g-1', user_id: 'otro', name: 'Vacaciones', target_amount: 1000 }], 'user-1')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Vacaciones', target_amount: 1000, user_id: 'user-1' })
    expect('id' in rows[0]!).toBe(false)
  })
})

describe('insertBatches', () => {
  const raw = (n: number): Record<string, unknown>[] =>
    Array.from({ length: n }, (_, i) => ({ n: i }))

  it('inserta en lotes del tamaño indicado y reporta progreso acumulado', async () => {
    const insertCalls: number[][] = []
    const progress: number[] = []

    const result = await insertBatches(
      raw(250),
      (chunk) => chunk.map((r) => r.n as number),
      100,
      {
        insert: async (rows) => {
          insertCalls.push(rows)
          return { error: null }
        },
        onProgress: (n) => progress.push(n),
      }
    )

    expect(insertCalls).toHaveLength(3)
    expect(insertCalls[0]).toHaveLength(100)
    expect(insertCalls[1]).toHaveLength(100)
    expect(insertCalls[2]).toHaveLength(50)
    expect(progress).toEqual([100, 200, 250])
    expect(result.inserted).toBe(250)
    expect(result.failed).toBe(0)
    expect(result.firstError).toBeNull()
  })

  it('si un lote falla, sigue con el resto y acumula el primer error', async () => {
    const insertCalls: number[][] = []
    const result = await insertBatches(
      raw(250),
      (chunk) => chunk.map((r) => r.n as number),
      100,
      {
        insert: async (rows) => {
          insertCalls.push(rows)
          // falla solo el segundo lote (empieza en n=100)
          return rows[0] === 100 ? { error: { message: 'boom' } } : { error: null }
        },
        onProgress: () => {},
      }
    )

    expect(insertCalls).toHaveLength(3)
    expect(result.inserted).toBe(150)
    expect(result.failed).toBe(100)
    expect(result.firstError).toBe('boom')
  })

  it('no llama a insert si no hay filas', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const result = await insertBatches([], () => [], 100, {
      insert,
      onProgress: () => {},
    })
    expect(insert).not.toHaveBeenCalled()
    expect(result.inserted).toBe(0)
    expect(result.failed).toBe(0)
  })
})
