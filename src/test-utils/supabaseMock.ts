import { vi } from 'vitest'

/**
 * Crea un query builder "thenable" que imita la API encadenable de
 * Supabase (.select().eq().order()...) y se resuelve con el resultado
 * indicado al hacer `await`.
 *
 * Los métodos son vi.fn(), así que en el test se puede inspeccionar con
 * qué se llamaron (por ejemplo, para verificar que .insert() recibió los
 * campos correctos — la regresión de la Fase 0).
 */
export function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chainableMethods = [
    'select',
    'eq',
    'neq',
    'order',
    'range',
    'insert',
    'update',
    'delete',
    'upsert',
    'in',
    'gte',
    'lte',
    'single',
  ]

  for (const method of chainableMethods) {
    builder[method] = vi.fn(() => builder)
  }

  // Hace que `await supabase.from('x').select().eq(...)` funcione: al ser
  // "thenable", el await resuelve directamente con `result`.
  builder.then = (
    resolve: (value: typeof result) => unknown,
    reject?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject)

  return builder
}

export interface SupabaseMockConfig {
  user?: { id: string; email?: string } | null
  /** Resultado por defecto que devuelve `.from(tableName)` */
  tableResults?: Record<string, { data: unknown; error: unknown }>
  /** Resultado por defecto que devuelve `.rpc(fnName, args)` */
  rpcResults?: Record<string, { data: unknown; error: unknown }>
}

const DEFAULT_USER = { id: 'user-1', email: 'test@example.com' }

/**
 * Crea un mock del cliente de Supabase para usar en tests de componentes.
 * Se usa junto con vi.hoisted + vi.mock('@/lib/supabaseClient', ...) — ver
 * los archivos de test para el patrón completo.
 */
export function createSupabaseMock(config: SupabaseMockConfig = {}) {
  const user = config.user === undefined ? DEFAULT_USER : config.user
  const tableResults = config.tableResults ?? {}
  const rpcResults = config.rpcResults ?? {}

  const fromCalls: string[] = []

  const mock = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      return makeQueryBuilder(tableResults[table] ?? { data: [], error: null })
    }),
    rpc: vi.fn(async (fnName: string) => rpcResults[fnName] ?? { data: [], error: null }),
    _fromCalls: fromCalls,
  }

  return mock
}
