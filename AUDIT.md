# Auditoría UnMango — Roadmap por fases

Este documento organiza los hallazgos de la auditoría en tandas, de más a menos urgente.

## ✅ Fase 0 — Bug crítico (resuelto en este commit)

**Botón "Pagar" en Suscripciones (`RecurringManager.handleImpactTransaction`)**
estaba insertando en `transactions` con campos que no existen en el schema
(`title`, `notes`) y sin los campos requeridos (`description`, `payment_method`,
`is_usd`). Además usaba un tipo de cambio hardcodeado (`amount * 1000`) para
convertir gastos en USD.

Cambios:
- Se usan los campos reales del tipo `Transaction`.
- Si la suscripción es en USD, se pide la cotización actual (igual que en el
  formulario manual) en vez de un multiplicador fijo.
- Si falla el insert, ahora se muestra un `alert` visible (antes solo quedaba
  en la consola y el usuario no se enteraba de que el pago no se había
  registrado).

## ✅ Fase 1 — Seguridad (resuelto en este commit, con una acción pendiente tuya)

- [x] **Defensa en profundidad en el frontend**: todas las consultas que
  antes traían filas de todos los usuarios (`categories`, `transactions`,
  `budgets`, `recurring_expenses`) ahora filtran explícitamente por
  `.eq('user_id', user.id)`.
- [ ] **⚠️ Acción tuya, no puedo hacerla yo**: correr
  `supabase/rls_policies.sql` en el SQL Editor de tu proyecto Supabase.
  Sin esas políticas de Row Level Security, el filtrado del frontend es
  solo un parche visual — cualquiera con las credenciales anon podría
  seguir pidiendo todo por API directa. El archivo incluye al final una
  query para verificar que las 4 tablas quedaron con RLS habilitado.
- [ ] Confirmar que `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` estén seteadas en
  Vercel (producción) y no cayendo en el fallback `placeholder.supabase.co`.

## 🟠 Fase 2 — Bugs menores y UX

- [x] `TransactionFilters.exportToCSV()` ahora exporta la lista filtrada
  (`visibleTransactions`) en vez de siempre todas las transacciones.
- [ ] Reemplazar `alert()`/`confirm()` nativos por un componente de
  toast/modal propio, consistente con el resto del diseño. (Pendiente:
  hoy ya avisan todos los errores, pero con `alert()` nativo del navegador,
  que corta la estética de la app.)
- [x] Revisar otros `console.error` sin feedback visible al usuario
  (`BudgetManager`, `CategoryManager`, `RecurringManager`, borrado de
  transacciones en `page.tsx`). Ahora todos muestran un `alert` o, en el
  caso de la carga inicial de presupuestos, un banner de error visible.

## 🟡 Fase 3 — Deuda técnica

- [x] **Tipos de Supabase**: se agregó `src/types/database.ts` con el tipo
  `Database` (escrito a mano en base al schema conocido — el archivo tiene
  una nota de cómo reemplazarlo por el generado real con
  `supabase gen types typescript` cuando tengas la CLI a mano). Se tipó el
  cliente (`createClient<Database>`) y `types/index.ts` ya no duplica las
  interfaces: `Category`, `Transaction`, `Budget` y `RecurringExpense`
  ahora derivan de `Database`. Verificado con `npx tsc --noEmit`: 0
  errores. Un bug como el de la Fase 0 ahora lo marca el compilador.
  - Nota: al correr `eslint` aparecen 4 errores de la regla
    `react-hooks/set-state-in-effect` que ya existían antes de esta
    auditoría (`TransactionForm`, `TransactionFilters`, `PrivacyContext`).
    No los toqué para no meter cambios de comportamiento fuera de
    alcance; quedan para una futura tanda de refactor de efectos.
- [x] **Hook/contexto compartido de categorías**: se agregó
  `src/context/CategoriesContext.tsx` (`CategoriesProvider` +
  `useCategories()`), colgado del layout junto al `PrivacyProvider`. Antes
  se repetía casi el mismo `fetch` de categorías en 5 componentes
  (`TransactionForm`, `CategoryManager`, `BudgetManager`,
  `RecurringManager`, `TransactionFilters`); ahora todos leen del mismo
  contexto y `CategoryManager` llama a `refreshCategories()` después de
  crear/borrar. Verificado con `npx tsc --noEmit`: 0 errores.
  - Nota de lint: el `useEffect` que dispara la carga inicial en
    `CategoriesContext` tiene el mismo warning pre-existente
    (`react-hooks/set-state-in-effect`) que ya tenían varios componentes
    antes de esta auditoría — es el patrón normal de "cargar datos al
    montar", lo dejo anotado junto con los demás para una futura tanda de
    refactor de efectos, no es un bug funcional.
- [x] **Paginación del historial + totales en Postgres**: se agregó
  `supabase/functions.sql` con dos funciones RPC:
  - `get_transaction_totals()`: suma ingresos/gastos de TODA la historia
    del usuario en Postgres, sin traer las filas al cliente.
  - `get_monthly_category_spend(p_year, p_month)`: gasto acumulado por
    categoría del mes indicado, también calculado en el servidor.

  `page.tsx` ahora pagina la lista visual de a 50 movimientos (`PAGE_SIZE`)
  con `.range()` y un botón "Cargar más movimientos", mientras que el
  balance y los totales de las tarjetas superiores vienen de
  `get_transaction_totals()` — así que **no se ven afectados por cuántas
  páginas cargaste**. `BudgetManager` ya no recibe `transactions` como
  prop: calcula el gasto del mes vía `get_monthly_category_spend()`.

  ⚠️ **Ojo con esto al elegir un enfoque más simple** (algo que evalué y
  descarté): agregar solo un `.limit()` a la query de transacciones sin
  las funciones RPC hubiera sido más rápido, pero habría hecho que el
  balance mostrado fuera incorrecto para cualquier usuario con más
  movimientos que ese límite — un bug serio y silencioso en una app de
  finanzas. Por eso separé "cuántas filas traigo para mostrar" de "cómo
  calculo los totales".

  **⚠️ Acción tuya**: correr `supabase/functions.sql` en el SQL Editor de
  Supabase (después de `rls_policies.sql`), igual que en la Fase 1.

  Nota: el buscador de `TransactionFilters` ahora solo busca dentro de los
  movimientos ya cargados (no en todo el historial) — es un trade-off
  aceptado del paginado; si querés búsqueda sobre todo el historial más
  adelante, se puede mover el filtro de texto a una query contra Supabase
  en vez de un filtro en el array local.

Verificado con `npx tsc --noEmit`: 0 errores. `npx next build` falla en
este sandbox solo por no tener acceso a `fonts.googleapis.com` (fuera del
allowlist de red acá), no por el código.

- [ ] Evaluar si conviene implementar `middleware.ts` + `@supabase/ssr`
  (ya está como dependencia pero no se usa en ningún lado) para proteger
  rutas del lado del servidor, o sacar la dependencia si se decide seguir
  100% client-side. (Único ítem que queda abierto de la Fase 3.)

## 🟢 Fase 4 — Testing (hoy no hay ningún test)

- [ ] Setup de **Vitest + React Testing Library** para componentes.
  Empezar por `RecurringManager` y `BudgetManager` (lógica más delicada).
- [ ] Test que reproduzca el bug de la Fase 0, para que no vuelva a colarse.
- [ ] **Playwright** E2E: login → cargar transacción → verifica balance →
  exportar CSV.

## 🔵 Fase 5 — Nuevas funcionalidades (ideas)

- [ ] Saldo por billetera/cuenta (no solo transacciones sueltas).
- [ ] Metas de ahorro con proyección (FV de anualidad).
- [ ] Recordatorio antes del vencimiento de una suscripción.
- [ ] Gráfico de tendencia de gasto por categoría en el tiempo.
- [ ] Modo oscuro.
- [ ] Importar resumen bancario/CSV.

---
_Generado en sesión de auditoría con Claude — 28/07/2026._
