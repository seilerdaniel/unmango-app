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

## ✅ Fase 1b — Defensa en profundidad: instalaciones y gastos (resuelto)

- [x] **`installment_purchases` en widgets**: `FinancialAdviceWidget` y
  `FinancialHealthScoreWidget` consultaban `installment_purchases` sin
  `.eq('user_id', user.id)`, confiando solo en RLS (como hacía la Fase 1
  con `categories`, `transactions`, `budgets` y `recurring_expenses`).
  Ahora ambos filtran explícitamente por `user_id`, alineándose con el
  resto de la app. Hallado en la auditoría de arquitectura (item #12 de la
  lista priorizada). Verificado: `tsc --noEmit` 0 errores, 293/293 tests
  pasando.

## ✅ Fase 1c — Refactor de arquitectura: contextos compartidos (items #1 y #2 de la auditoría)

La auditoría de arquitectura encontró que la pestaña Inicio hacía **~13
consultas simultáneas a Supabase** (los mismos agregados recomputados por
cada widget) y que **6 componentes** repetían la misma carga de
`wallets` al montar. Se resolvió con dos contextos globales:

- [x] **`src/context/DashboardDataContext.tsx`** (`DashboardDataProvider`):
  trae UNA sola vez las agregaciones compartidas por los widgets de Inicio
  — `get_monthly_trend {p_months:1}`, gastos del mes, recurrentes activos,
  `installment_purchases` del usuario y `get_transaction_totals` — en
  paralelo (`Promise.all`). Refactorizados para leer de ahí (dejaron de
  consultar Supabase por su cuenta):
  `FinancialHealthScoreWidget`, `FinancialAdviceWidget` (conserva sus
  señales propias: cambios de precio, presupuestos, deuda, metas,
  categorías, hogar), `ZeroSpendStreak`, `MonthEndProjection` y
  `SafeToSpendWidget`. `page.tsx` también lee los totales del header de
  este contexto (eliminó su `fetchTotals` propio).
  - Nota: se implementó como contexto sobre las RPC ya existentes en vez
    de crear una RPC nueva — el objetivo era eliminar la duplicación sin
    sumar SQL pendiente de correr. Una RPC `get_dashboard_data` única
    queda como optimización futura si hiciera falta.
- [x] **`src/context/WalletsContext.tsx`** (`WalletsProvider`): fuente única
  de billeteras + saldos (`get_wallet_balances`). Refactorizados para
  leer de ahí: `WalletCarousel`, `WalletManager`, `TransactionForm`
  (el quick-add de billetera llama a `refresh()`), `RecurringManager`,
  `ImportTransactions` y `VoiceExpenseInput`. `page.tsx` deriva el
  "En billeteras" del header y el refresco del total de este contexto.
- [x] **Mecanismo de refresco unificado**: en `page.tsx`, `dataVersion`
  ahora dispara `refresh()` de ambos contextos (efecto sobre
  `dataVersion`). Se eliminaron los remounts por `key={`score-${dataVersion}`}`
  de Score y Recomendaciones. Cada alta/baja de movimiento (via
  `fetchTransactions`) y cada cierre de Configuración refrescan todo en
  un solo lugar.
- [x] Tests actualizados para envolver con `WalletsProvider`
  (`WalletManager`, `RecurringManager`, `VoiceExpenseInput`,
  `SpeedDialFab` — que renderiza `VoiceExpenseInput`).
  Verificado: `tsc --noEmit` 0 errores, 293/293 tests pasando, `next build` OK.

## ✅ Fase 1d — Hook `useAsyncData` (item #4 de la auditoría)

Los contextos compartidos (`DashboardDataContext`, `WalletsContext`)
repetían exactamente el mismo andamiaje de manejo asíncrono (estado
`data`/`loading`/`error` + `refresh` con `try/catch/finally` + efecto de
carga al montar), y `FinancialAdviceWidget` tenía uno propio además.
Se unificó en un solo hook:

- [x] **`src/hooks/useAsyncData.ts`** — `useAsyncData<T>(loader, errorMessage)`
  devuelve `{ data, loading, error, refetch }`:
  - `loading` arranca en `true` y se apaga tras la primera carga; los
    `refetch()` siguientes corren en background SIN re-encenderlo (los
    refrescos por `dataVersion` no hacen parpadear la UI).
  - En un fallo se conservan los datos previos (`data` no se vacía) y se
    setea `error`; se limpia al volver a cargar.
  - El `loader` debe ser estable (`useCallback`); si depende de datos que
    cambian (ej. el dashboard), el hook recarga automáticamente al
    cambiar, igual que un `useEffect` con deps.
- [x] **`DashboardDataContext` y `WalletsContext` reescritos sobre el hook**:
  los dos ahora solo definen el `loader` (el `Promise.all` de consultas) y
  derivan el resto. API pública sin cambios (`data`/`loading`/`error`/
  `refresh`), así que ningún consumidor se tocó por esto. `totalBalance`
  pasó a derivarse con `useMemo` (el array vacío mantiene identidad
  estable entre renders).
- [x] **`FinancialAdviceWidget` reescrito sobre el hook**: se eliminaron
  los estados locales `advice`/`noData`/`loading` y el `useEffect` con
  `load()` — el loader del hook ejecuta las mismas señales propias
  (precios, presupuestos, deuda, metas, categorías, hogar) y vuelve a
  correr cuando cambia `dashboard` o `wallets` (equivalentes a las deps
  del efecto anterior).
- [x] **Revisión de los demás widgets de Inicio**: `FinancialHealthScoreWidget`,
  `ZeroSpendStreak`, `MonthEndProjection` y `SafeToSpendWidget` derivan
  todo de forma síncrona del contexto — no tienen manejo asíncrono
  propio que deduplicar, así que no se les tocó nada. `page.tsx` tampoco
  (su `loading` es bootstrap de sesión + paginación manual, un caso
  distinto). El patrón `error`/`refetch` queda disponible de forma
  uniforme vía el hook para cuando se quiera agregar una UI de reintento
  en los widgets.
- [x] Test nuevo: `src/hooks/__tests__/useAsyncData.test.tsx` (6 tests —
  carga inicial, loader que devuelve null, error, refetch en background,
  recarga automática al cambiar el loader, y conservación de datos en
  error).

Verificado: `tsc --noEmit` 0 errores, 299/299 tests pasando (293 + 6 del
hook), `next build` OK, `eslint` bajó de 20 a **19 errores** (todos del
patrón pre-existente `react-hooks/set-state-in-effect`, ahora concentrado
en un solo lugar).

## ✅ Fase 1e — BackupRestore: escritura por lotes (item #3 de la auditoría)

El restore insertaba **una fila por request** (y categorías/billeteras
con un `.select('id').single()` por fila para capturar el id recién
generado). Se refactorizó a escritura en lotes:

- [x] **`src/lib/backupRestore.ts`** (nuevo, lógica pura testable):
  - `chunk()` — parte un array en lotes; `generateId()` — uuid generado
    en el cliente (con fallback). Ahora las categorías/billeteras llevan
    el id nuevo explícito en el insert, así el mapa viejo→nuevo se arma
    en memoria sin leer de vuelta cada fila (se eliminaron los
    `.select('id').single()` de a uno).
  - Builders por tabla (`buildCategoryInsertRows`, `buildWalletInsertRows`,
    `buildTransactionInsertRows`, `buildBudgetInsertRows`,
    `buildRecurringInsertRows`, `buildGoalInsertRows`): preparan las filas
    del lote con `user_id` seteado y FKs remapeados.
  - `insertBatches()` — orquesta el flujo: por cada lote de hasta
    `RESTORE_BATCH_SIZE` (100) prepara, inserta, reporta progreso
    acumulado y cede el hilo (`yieldToUI()`, un `setTimeout(0)` entre
    lotes para que React pinte el avance).
- [x] **Bug latente corregido**: `recurring_expenses.wallet_id` tiene FK
  a `wallets(id)`, pero el restore viejo no lo remapeaba (dejaba el id
  viejo del backup → violación de FK y la fila no entraba, en silencio).
  Ahora `buildRecurringInsertRows` lo remapea igual que `category_id`.
- [x] **Progreso visible**: barra de progreso con la sección actual,
  `done de total` y % — se actualiza entre lotes porque se cede el hilo,
  así la UI no se congela en restauraciones grandes.
- [x] **Errores por lote**: si un lote falla NO se aborta el resto (el
  restore es aditivo, mejor que entre lo que sí puede), se acumula el
  primer error y al final se muestra un banner ámbar: "Se insertaron X de
  Y registros. N no se pudieron insertar (primer error: ...)".
- [x] **Rollback transaccional**: no se puede hacer con el cliente de
  Supabase — cada `.insert()` es una operación independiente, el cliente
  no soporta transacciones multi-statement. Se optó por la alternativa
  que pedía la tarea ("notificar el estado de avance"). Un rollback
  atómico real requeriría una RPC `security definer` que haga todo en una
  transacción SQL — queda anotado como optimización futura.
- [x] Tests: `src/lib/__tests__/backupRestore.test.ts` (21 tests: chunk,
  remapForeignKey, builders con remap/filtrado, `insertBatches` con
  progreso y con fallo de un lote que no frena el resto) +
  `src/components/__tests__/BackupRestore.test.tsx` (2 tests de flujo:
  250 movimientos se insertan en 3 lotes de 100, y el banner de error
  cuando un lote falla). Se reemplazó el `BackupRestore.test.ts` viejo
  (que solo testeaba `remapForeignKey`).

Verificado: `tsc --noEmit` 0 errores, **318/318 tests** pasando (299 + 19
nuevos), `next build` OK, `eslint` sin cambios (19 errores de la línea
base pre-existente, nada nuevo).

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

## ✅ Fase 4 — Testing (resuelto en este commit, con una acción pendiente tuya)

- [x] **Setup de Vitest + React Testing Library**: `vitest.config.ts` +
  `vitest.setup.ts`, con jsdom y el alias `@/` resuelto igual que en la
  app. Scripts nuevos en `package.json`: `npm test` (corre una vez),
  `npm run test:watch`, `npm run test:coverage`.
- [x] **`src/test-utils/supabaseMock.ts`**: helper para mockear el
  cliente de Supabase en tests de componentes (query builder encadenable
  + RPC), sin pegarle a un proyecto real.
- [x] **4 archivos de test, 6 tests, los 6 pasando** (`npx vitest run`):
  - `RecurringManager.test.tsx`: **regresión directa de la Fase 0** —
    verifica que el insert al "Pagar" una suscripción tenga `description`/
    `payment_method`/`is_usd` (no `title`/`notes`), y que las
    suscripciones en USD pidan la cotización en vez de usar un
    multiplicador fijo.
  - `TransactionFilters.test.tsx`: **regresión de la Fase 2** — verifica
    que "Exportar CSV" respete el filtro aplicado (no exporte todo).
  - `BudgetManager.test.tsx`: verifica que "Excedido" aparezca/no
    aparezca según el gasto que devuelve `get_monthly_category_spend`
    (RPC de la Fase 3).
  - `CategoriesContext.test.tsx`: **regresión de la Fase 1** — verifica
    que la carga de categorías siga filtrando por `user_id`.
- [x] **Playwright configurado** (`playwright.config.ts`, carpeta `e2e/`,
  script `npm run test:e2e`):
  - `e2e/login.spec.ts`: smoke test de la pantalla de login, no necesita
    backend — debería correr tal cual.
  - `e2e/critical-flow.spec.ts`: flujo completo (cargar un gasto → ver
    balance actualizado) mockeando las llamadas de red a Supabase con
    `page.route()`, para no depender de un proyecto real ni de datos de
    prueba. **Está con `test.skip(...)`** porque no se pudo verificar en
    este sandbox (ver nota abajo) — sacá el skip después de correrlo una
    vez en tu máquina y confirmar que pasa.

  **⚠️ No pude instalar el navegador de Playwright en este sandbox**:
  `npx playwright install` necesita descargar Chromium desde
  `cdn.playwright.dev`, un dominio fuera de la red permitida acá. Corré
  `npx playwright install` en tu máquina antes de usar `npm run test:e2e`.
  Los tests de `login.spec.ts` no tienen razón para fallar (no dependen
  de mocks de red), pero `critical-flow.spec.ts` quedó con
  `test.skip(...)` hasta que lo valides vos — si algún patrón de URL de
  `page.route` no coincide con tu proyecto real, ajustalo ahí mismo (hay
  comentarios explicando cada mock).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores), `npx eslint .`
(misma línea base de siempre: 4 errores/4 warnings pre-existentes, nada
nuevo), `npx vitest run` (4 archivos, 6 tests, todos pasando).

## 🔵 Fase 5 — Nuevas funcionalidades

- [x] **Saldo por billetera/cuenta** — implementado en este commit:
  - `supabase/wallets.sql`: tabla `wallets` (nombre, tipo, color, saldo
    inicial), columna `wallet_id` nullable en `transactions`, políticas
    RLS, y la función `get_wallet_balances()` (saldo = inicial + ingresos
    - gastos de sus movimientos, calculado en Postgres).
  - `WalletManager.tsx`: alta/baja de billeteras + saldo actual de cada
    una, ya agregado al dashboard (columna lateral).
  - `TransactionForm.tsx`: selector de billetera opcional al cargar un
    movimiento (si no elegís ninguna, el movimiento no impacta ningún
    saldo — no rompe nada de lo que ya existía).
  - Tests nuevos: `WalletManager.test.tsx` (2 tests: saldo vía RPC, alta
    de billetera con los campos correctos).

  **⚠️ Acción tuya**: correr `supabase/wallets.sql` en el SQL Editor de
  Supabase (después de `rls_policies.sql` y `functions.sql`).

  Decisión de alcance: las billeteras se llevan en ARS por ahora (usan
  `amount_ars`, igual que el resto del dashboard). Si más adelante querés
  una billetera 100% en USD (por ejemplo, ahorros en dólar billete), se
  puede sumar sin romper esto — no lo armé ahora para no sobrediseñar
  algo que no se pidió.

  Nota de lint: `WalletManager` tiene el mismo warning pre-existente de
  `react-hooks/set-state-in-effect` que ya tenían los otros componentes
  con "cargar datos al montar" (ver Fase 3) — no es un bug funcional.

  Verificado en este sandbox: `npx tsc --noEmit` (0 errores), `npx vitest
  run` (5 archivos, 8 tests, todos pasando).

- [x] **Metas de ahorro con proyección** — `supabase/savings_goals.sql`
  (tabla `savings_goals` con RLS) + `SavingsGoals.tsx`: creás una meta
  (objetivo, ya ahorrado, aporte mensual, interés mensual opcional) y se
  simula mes a mes (valor futuro de anualidad) cuántos meses faltan para
  alcanzarla, con un mini-gráfico de la proyección. El "ya ahorrado" se
  actualiza a mano (no está linkeado a ninguna billetera automáticamente
  — es un dato manual, como en tu otra app de finanzas). Tests:
  `SavingsGoals.test.tsx` (2 tests, incluye un caso con matemática exacta:
  objetivo 12000, aporte 1000/mes sin interés → exactamente 12 meses).

- [x] **Gráfico de tendencia mensual** — `supabase/trend.sql` (función
  `get_monthly_trend(p_months)`, calculada en Postgres) + `TrendChart.tsx`:
  barras de ingresos vs. gastos de los últimos 6 meses. Alcance: es
  tendencia mensual total (ingresos/gastos), no desglosada por categoría
  — lo pedido originalmente era "por categoría en el tiempo"; hacerlo por
  categoría además de por mes es un gráfico multi-serie más denso, lo dejo
  como posible ampliación si te sirve más que la vista general. Tests:
  `TrendChart.test.tsx` (2 tests).

- [x] **Aviso de vencimiento próximo** — dos capas:
  1. **Dentro de la app** (ya estaba): `RecurringManager.tsx` calcula
     cuántos días faltan para el próximo vencimiento de cada suscripción
     activa y muestra un banner ("Vencen pronto: Netflix (en 2d)...") más
     un badge individual cuando faltan 7 días o menos. Tests: 2 en
     `RecurringManager.test.tsx`.
  2. **✅ Recordatorio real por email (nuevo)** —
     `supabase/functions/send-renewal-reminders/`: una Edge Function de
     Supabase que corre por cron una vez al día, revisa las suscripciones
     activas de TODOS los usuarios, y le manda un email (vía
     [Resend](https://resend.com)) a quien tenga una suscripción venciendo
     dentro de 3 días (configurable con `REMINDER_DAYS_BEFORE` en
     `index.ts`). `supabase/reminders_cron.sql` programa el cron
     (`pg_cron` + `pg_net`) que la invoca todos los días.

     La lógica de "cuántos días faltan" vive separada en `date-utils.ts`
     (sin nada de Deno) para poder testearla con Vitest igual que el
     resto del proyecto: `date-utils.test.ts`, 8 tests (incluye el caso
     de clamp de fin de mes, ej. día 31 en febrero).

     **⚠️ Esto es código listo para desplegar, no algo que yo pueda dejar
     funcionando solo**: necesita que vos crees una cuenta en Resend
     (tiene plan gratis), configures 2-3 secrets con la CLI de Supabase, y
     corras `supabase functions deploy`. Los pasos exactos, uno por uno,
     están en `supabase/functions/send-renewal-reminders/README.md`. Sin
     hacer esos pasos, el banner dentro de la app (punto 1) sigue

     **Corrección post-despliegue (probado en el proyecto real del
     usuario)**: al probar con `curl` dio
     `{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}`. No es un bug de nuestro
     código — el gateway de Supabase exige un header `Authorization:
     Bearer <anon_key>` en toda Edge Function por defecto, antes de que
     la request llegue a `index.ts` (nuestro chequeo de `x-cron-secret`
     es una capa aparte, encima de esa). Se corrigió agregando ese header
     tanto en `reminders_cron.sql` como en el `curl` de prueba del
     README. Si ya habías corrido la versión vieja del SQL, no hace falta
     borrar el job: `cron.schedule()` con el mismo nombre actualiza el
     job existente en vez de duplicarlo — alcanza con volver a correr el
     archivo corregido.
     funcionando igual que antes — esto es un agregado, no un reemplazo.

- [x] **Modo oscuro** — `ThemeContext.tsx` (toggle persistido en
  localStorage, con un script inline en `layout.tsx` para evitar el flash
  de modo claro al recargar), `globals.css` con
  `@custom-variant dark (&:where(.dark, .dark *))` para que el toggle
  manual funcione (Tailwind v4). El botón está en el header.

  **✅ Completado (actualización posterior)**: se agregaron clases `dark:`
  a los 10 componentes que faltaban (`BudgetManager`, `RecurringManager`,
  `TransactionForm`, `TransactionFilters`, `CategoryManager`,
  `WalletManager`, `SavingsGoals`, `TrendChart`, `ImportTransactions`,
  `FinanceChart`) y a la pantalla de `login`. Los gráficos de chart.js
  (`TrendChart`, `FinanceChart`) no reaccionan solo a clases CSS —ahí
  usan `useTheme()` para pasarle explícitamente el color de texto/grilla
  correcto según el tema activo. Se agregó un mock de `window.matchMedia`
  en `vitest.setup.ts` (jsdom no lo implementa) para que los tests que
  usan `ThemeProvider` no rompan.

  **Corrección post-prueba en local (`npm run dev`)**: el script inline
  que evita el flash de modo claro modifica el `className` de `<html>`
  ANTES de que React hidrate, lo cual React marca como "hydration
  mismatch" (aparece en la consola del navegador, no rompe la app, pero
  ensucia el log). Es un desajuste esperado, no un bug — se le agregó
  `suppressHydrationWarning` al `<html>` en `layout.tsx` para que React
  lo ignore puntualmente en ese atributo. Es el patrón recomendado por
  Next.js para este caso exacto (toggle de tema con script anti-flash).

- [x] **Importar resumen bancario (CSV)** — `ImportTransactions.tsx`
  (usa `papaparse`): subís un `.csv`, elegís qué columna es fecha/
  descripción/monto (con auto-detección por nombre de columna), previsualizás
  las filas parseadas y las importás en lote. Soporta formato de número
  argentino (miles con punto, decimales con coma) y ambos formatos de
  fecha (ISO y dd/mm/yyyy). No es un parser específico de ningún banco en
  particular — es genérico, así que debería andar con la mayoría de los
  exports, pero no lo pude probar contra un CSV real de tu banco (no
  tengo uno a mano). Tests: `ImportTransactions.test.tsx` (10 tests
  unitarios sobre el parseo de fechas y montos, que es la parte con más
  riesgo de casos borde).

Verificado en este sandbox, con todas las features de esta tanda juntas:
`npx tsc --noEmit` (0 errores), `npx eslint .` (misma línea base
pre-existente + 2 casos nuevos del mismo warning de "cargar al montar"
que ya tenían los demás componentes — no son bugs), `npx vitest run`
(8 archivos, 24 tests, todos pasando).

**⚠️ 3 SQL nuevos para correr** (después de `rls_policies.sql`,
`functions.sql` y `wallets.sql`, en este orden):
`savings_goals.sql` → `trend.sql`. (`wallets.sql` ya lo tenías de la
tanda anterior.)

## ✅ Infraestructura de recordatorios reales (tanda posterior)

Se agregó la Edge Function + cron para que el aviso de vencimiento
llegue por email de verdad (no solo dentro de la app). Ver el detalle
completo más arriba, en el punto 2 del ítem "Aviso de vencimiento
próximo" de la Fase 5.

**⚠️ Acciones tuyas** (paso a paso completo en
`supabase/functions/send-renewal-reminders/README.md`):
1. Crear cuenta en Resend y conseguir un API key.
2. `supabase secrets set RESEND_API_KEY=... CRON_SECRET=...`
3. `supabase functions deploy send-renewal-reminders`
4. Correr `supabase/reminders_cron.sql` (reemplazando `<PROJECT_REF>` y
   `<CRON_SECRET>`) en el SQL Editor de Supabase.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — se excluyó
`supabase/functions/**/index.ts` del tsconfig del proyecto porque es
código Deno, no Next.js), `npx eslint .` (misma línea base, nada nuevo),
`npx vitest run` (**9 archivos, 32 tests**, todos pasando — sumó
`date-utils.test.ts` con 8 tests sobre la lógica de vencimientos).

## ✅ Ideas nuevas — "quick wins" (tanda posterior)

Se evaluaron 20 ideas nuevas propuestas por el usuario (documento
aparte); 3 ya estaban construidas (recordatorio de vencimientos, metas
de ahorro, multi-cuenta/billeteras — ver Fase 5). De las 17 restantes,
se eligieron 4 "quick wins" para esta tanda:

- [x] **Atajos de teclado** (`src/hooks/useKeyboardShortcuts.ts`): `N`
  enfoca el campo de descripción para cargar rápido, `P` alterna el modo
  privado, `/` enfoca el buscador del historial. La lógica de "ignorar si
  el foco ya está en un campo de formulario" es una función pura
  (`shouldIgnoreShortcut`) testeada aparte (6 tests) — incluyó un ajuste
  porque jsdom no implementa bien `isContentEditable`, así que también se
  chequea el atributo `contenteditable` directamente (más robusto en
  navegadores reales, no solo un parche para el test). Hint visual en el
  header (oculto en mobile).

- [x] **Racha "Cero Gastos"** (`src/lib/zeroSpendStats.ts` +
  `ZeroSpendStreak.tsx`): cuenta los días del mes sin ningún gasto
  registrado y la racha actual de días consecutivos. La consulta a
  Supabase solo trae las *fechas* de los gastos del mes (no las
  transacciones completas), y todo el cálculo de racha es una función
  pura testeada aparte (5 tests).

- [x] **Calculadora ARS / USD Blue** (`ArsUsdCalculator.tsx`): botón
  flotante con conversión en vivo en ambos sentidos. Trae la cotización
  de [dolarapi.com](https://dolarapi.com) (pública, sin API key) al
  abrir el popover; si falla, el usuario puede cargar la cotización a
  mano — no rompe la calculadora. Las conversiones (`arsToUsd`/
  `usdToArs`) son funciones puras testeadas aparte (6 tests).

- [x] **Backup / Restore en JSON** (`BackupRestore.tsx`): descarga todas
  tus tablas (categorías, billeteras, presupuestos, suscripciones, metas,
  transacciones) en un único archivo JSON. La restauración inserta todo
  de nuevo con IDs frescos y **remapea** `category_id`/`wallet_id` a los
  nuevos IDs generados (la función `remapForeignKey` es pura y está
  testeada, 4 tests). Es aditiva, no reemplaza nada existente — restaurar
  el mismo archivo dos veces duplica los datos, a propósito (evita
  sorpresas de "che, dónde quedó tal cosa" por un reemplazo silencioso).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
tipar explícitamente los inserts de `BackupRestore` porque TypeScript no
podía inferir los campos requeridos a través de un spread de
`Record<string, unknown>`), `npx eslint .` (misma línea base + 1 caso
nuevo del mismo warning pre-existente de "cargar al montar" en
`ArsUsdCalculator` — nada nuevo grave), `npx vitest run` (**13 archivos,
53 tests**, todos pasando).

Quedan 13 ideas sin trabajar del documento original (proyección a fin de
mes, gastos hormiga, gastos en cuotas, bot de Telegram, escaneo de
comprobantes/QR, etc.) — evaluadas con esfuerzo/infraestructura
necesaria en la conversación, para retomar cuando se decida.

## ✅ Ideas nuevas — segunda tanda (sin infraestructura nueva)

De las 13 ideas restantes, se implementan las 4 que se apoyan 100% en
lo que ya existe (sin SQL nuevo de infraestructura pesada, salvo una
columna chica):

- [x] **Presupuestos 50/30/20** (idea #20) —
  `supabase/budget_groups.sql` agrega `budget_group` (necesidad/deseo/
  ahorro, nullable) a `categories`. `BudgetRule502030.tsx` compara el
  gasto real de cada balde contra el objetivo 50/30/20 del ingreso del
  mes, con una vista para clasificar las categorías sin asignar. La
  cuenta (`computeRule502030`) es pura y está testeada (5 tests).
  **⚠️ Acción tuya**: correr `budget_groups.sql` en Supabase.

- [x] **Proyección a fin de mes** (idea #2) — `MonthEndProjection.tsx`:
  toma el promedio diario de gasto variable (separando lo que ya vino de
  "Pagar" una suscripción, que cuenta como fijo) y lo extrapola a lo que
  queda del mes, sumando los gastos fijos activos. `projectMonthEnd()` es
  pura y testeada (4 tests). Mismo criterio que "Fijo Comprometido" en
  Suscripciones: solo considera gastos fijos en ARS.

- [x] **Detección de gastos hormiga** (idea #4) — `AntExpenses.tsx`:
  suma los gastos del mes por debajo de un umbral configurable (por
  defecto $3.000, editable y persistido en localStorage).
  `detectAntExpenses()` es pura y testeada (4 tests).

- [x] **Captura "segura" para compartir** (idea #10) —
  `ShareBalanceCard.tsx`: genera una tarjeta de imagen (dibujada en
  `<canvas>`, sin librerías externas) con el balance del mes, **censurada
  por defecto** — hay que tocar explícitamente "Mostrar montos reales"
  antes de descargar. La lógica de qué mostrar/censurar
  (`buildShareCardLines`) es pura y está testeada (3 tests); el dibujo en
  sí no es testeable con Vitest (jsdom no implementa `<canvas>`, ver nota
  en Fase 4).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores), `npx eslint .`
(2 casos nuevos del mismo warning pre-existente de "cargar al montar" en
`AntExpenses` y `BudgetRule502030" — nada nuevo grave), `npx vitest run`
(**17 archivos, 69 tests**, todos pasando).

Quedan **9 ideas** de las 13 originales, todas con infraestructura nueva
o complejidad significativa (alerta de inflación de suscripciones,
simulador de brecha cambiaria, gastos en cuotas, PWA, exportar a PDF,
temas de contraste personalizados, ingreso por voz, escaneo de QR/AFIP,
bot de Telegram) — quedan para tandas siguientes.

## ✅ Ideas nuevas — tercera tanda

De las 9 restantes, se resuelven 3 completas y 1 parcial, todas sin
necesitar que el usuario cree ninguna cuenta externa:

- [x] **Temas de contraste personalizados** (idea #9) — **alcance
  parcial, evaluado y reducido a propósito**: la app usa un color de
  acento DISTINTO por sección (ámbar en transacciones, índigo en
  billeteras/suscripciones, esmeralda en ahorro/categorías) en vez de un
  único color de marca reemplazable. Reskinear paletas completas tipo
  "Cyber Neon" requeriría antes unificar esos colores en un sistema de
  tokens — un trabajo de diseño aparte, no un ajuste rápido. Lo que sí se
  implementó: la variante **OLED verdadero negro**
  (`ThemeContext.tsx` + `globals.css`), que en modo oscuro reemplaza el
  gris oscuro habitual por negro puro en el fondo de página — en
  pantallas OLED cada píxel negro está apagado, así que ahorra batería de
  verdad, no es solo estético. Toggle en el header, solo visible en modo
  oscuro.

- [x] **Alerta de inflación de suscripciones** (idea #3) —
  `supabase/subscription_price_history.sql`: un trigger graba
  automáticamente un snapshot del monto cada vez que se crea o actualiza
  una suscripción (no hay que acordarse de nada), y una función
  (`get_recurring_price_changes`) compara el precio actual contra el
  anterior. `SubscriptionPriceAlerts.tsx` muestra un aviso cuando algo
  aumentó. `detectPriceIncreases()` es pura y está testeada (4 tests).
  **⚠️ Acción tuya**: correr `subscription_price_history.sql`. Ojo: el
  historial arranca desde que corras el SQL — no hay manera de reconstruir
  aumentos de suscripciones que ya tenías cargadas antes de esto.

- [x] **Gastos en cuotas** (idea #14) — `supabase/installments.sql`
  (tablas `installment_purchases` e `installment_payments`) +
  `InstallmentTracker.tsx`: registrás una compra en N cuotas fijas y el
  plan se calcula en el momento (`computeInstallmentSchedule`, pura,
  testeada con 6 tests — reparte el redondeo en la última cuota para que
  la suma dé exacto). A diferencia de crear N transacciones futuras de
  una, cada cuota se convierte en una transacción real recién cuando la
  marcás como pagada (mismo patrón que "Pagar" en Suscripciones).
  **⚠️ Acción tuya**: correr `installments.sql`.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
declarar la relación `installment_purchases -> categories` en
`database.ts` para que el join tipado con `categories(name, color)`
funcionara), `npx eslint .` (1 caso nuevo del mismo warning
pre-existente, nada nuevo grave), `npx vitest run` (**19 archivos, 79
tests**, todos pasando).

**⚠️ 2 SQL nuevos para correr** (después de todos los anteriores):
`subscription_price_history.sql` → `installments.sql`.

Quedan **6 ideas**: simulador de brecha cambiaria, exportar a PDF, PWA,
ingreso por voz, escaneo de QR/AFIP, bot de Telegram.

## ✅ Auditoría de UX/UI (a partir de capturas del usuario)

El usuario mandó capturas mostrando que en `WalletManager` y
`RecurringManager` los campos del formulario "Agregar" se veían
cortados/incompletos ("Nom", "Mont", "Día del mes (1-31" truncado). Se
encontró la causa raíz y se corrigió en las 4 secciones que compartían el
mismo problema:

- [x] **Grids rígidos de 5 columnas** — `WalletManager`,
  `RecurringManager`, `SavingsGoals` e `InstallmentTracker` usaban
  `lg:grid-cols-5` (5 columnas fijas sin importar el ancho real del
  contenido). Se cambió a
  `lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]` en los 4: ahora
  cada campo tiene un mínimo de 150px y el grid los acomoda solo, bajando
  de línea si no entran, en vez de comprimirlos. También se acortaron
  placeholders largos ("Nombre (ej. Mercado Pago)" → "Nombre", con el
  ejemplo movido a un `title` de tooltip) para que entren cómodos incluso
  en pantallas angostas.

- [x] **Colores predefinidos** — `ColorPicker.tsx`: 7 pastillas de color
  (ámbar, esmeralda, índigo, rosa, cian, violeta, rojo) más una opción
  "personalizado" que abre el selector nativo del navegador, en vez de
  tener que abrir el selector cada vez. Integrado en `WalletManager` y
  `CategoryManager`.

- [x] **Íconos por categoría** — `supabase/category_icons.sql` agrega
  `icon` (texto) a `categories`. `IconPicker.tsx` ofrece 16 íconos
  curados (carrito, auto, casa, salud, educación, etc. — catálogo en
  `src/lib/categoryIcons.ts`). Los chips de categorías ahora muestran el
  ícono elegido en vez de solo un punto de color.
  **⚠️ Acción tuya**: correr `category_icons.sql`.

- [x] **15 categorías sugeridas** — `src/lib/suggestedCategories.ts`:
  catálogo de 15 categorías típicas de gastos personales (Supermercado,
  Transporte, Alquiler/Vivienda, Servicios, Salud, Educación,
  Entretenimiento, Ropa y Calzado, Restaurantes y Delivery, Mascotas,
  Cuidado Personal, Tecnología, Regalos, Viajes, Ahorro/Inversión), cada
  una con color e ícono coherente. Botón "Sugeridas" en `CategoryManager`
  que las carga de un click sin duplicar las que ya tengas (compara por
  nombre). Testeado: 7 tests (15 categorías exactas, sin nombres
  duplicados, todos los íconos referenciados existen en el catálogo).

- [x] **"Proveedor / App" no reflejaba las billeteras reales** — en
  `TransactionForm` había DOS selectores de billetera superpuestos: uno
  hardcodeado en el código (Mercado Pago, Personal Pay, Ualá, Lemon Cash,
  Naranja X, Otra — una lista fija que no tenía nada que ver con las
  billeteras reales que se crean en `WalletManager`, por eso una
  billetera nueva no aparecía ahí) y otro real (el que ya se había hecho
  en la Fase 5, que sí lee `wallets`). Se eliminó el selector hardcodeado
  y se unificó todo en el selector real, agregándole un botón "+ Nueva"
  que crea una billetera al vuelo sin salir del formulario de carga
  (para editarla o eliminarla, hay que ir a la sección Billeteras, que ya
  tiene esa gestión completa).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores), `npx eslint .`
(mismo patrón pre-existente de siempre, nada nuevo grave), `npx vitest
run` (**20 archivos, 86 tests**, todos pasando — se actualizó también
`WalletManager.test.tsx` porque buscaba el placeholder viejo).

### 📌 Backlog (idea del usuario, marcada explícitamente como "a futuro")

**Ejemplos predeterminados de metas de ahorro / presupuestos /
inversiones**: si el usuario no tiene ninguna meta/presupuesto cargado,
ofrecerle 2-3 sugerencias predefinidas para elegir (similar al patrón que
ya se implementó para categorías sugeridas). No se implementó en esta
sesión porque el usuario lo planteó explícitamente como una idea a
futuro, no un pedido para ahora — queda anotado para cuando se priorice.

## ✅ Segunda vuelta de auditoría UX/UI

- [x] **Controles nativos del navegador (flechas de número, dropdown de
  select) no seguían el tema oscuro** — causa raíz: `color-scheme`
  estaba fijo en `light` en `globals.css`, así que el navegador pintaba
  esos controles (flechas, el globo nativo "Completa este campo") con
  estética clara sin importar el tema activo de la app. Se agregó
  `html.dark { color-scheme: dark; }`. Además se ocultaron las flechas
  nativas de `<input type="number">` (inconsistentes entre navegadores,
  chocaban visualmente con el globo de validación) y se le puso una
  flecha propia a todos los `<select>` de la app — arreglado en un solo
  lugar (CSS global), sin tocar cada formulario uno por uno. La lista de
  opciones desplegada de un `<select>` la sigue pintando el sistema
  operativo — eso no se puede re-estilar con CSS en ningún sitio web, no
  es una limitación de esta app en particular.

- [x] **Calculadora normal** (`BasicCalculator.tsx`) — botón flotante
  gris apilado arriba del verde de ARS/USD Blue, para que se distingan a
  simple vista. 4 operaciones básicas. `applyOperator()` pura y testeada
  (5 tests) + 2 tests de interacción (calcula 2+3=5, el botón "C"
  reinicia).

- [x] **Mis Categorías: íconos y colores en un menú compacto** — antes
  el selector de íconos (16 opciones) estaba siempre visible ocupando
  una fila entera. Se armó `PopoverPicker.tsx` (genérico, se cierra al
  clickear afuera) y ahora tanto el color como el ícono son un botón
  chico que abre un panel al tocarlo.

- [x] **Suscripciones y Gastos Fijos** — se agregó medio de pago (mismo
  set de opciones que `TransactionForm`), tipo de membresía (texto
  libre, ej. "Premium", "Familiar"), y % de impuestos que el precio de
  lista NO incluye (con una nota aclaratoria visible en el formulario).
  El botón "Pagar" ahora registra el monto **con** impuestos incluidos
  (el gasto real que sale de la cuenta), y "Fijo Comprometido" también
  los contempla. `applyTax()` pura y testeada (4 tests).
  **⚠️ Acción tuya**: correr `supabase/recurring_extra_fields.sql`.

- [x] **Cards de "Mis Billeteras" con el saldo apretado contra el
  nombre** (a partir de una captura del usuario) — el layout ponía
  ícono+nombre a la izquierda y saldo+borrar a la derecha en la MISMA
  línea, dentro de una card angosta (grid de 2 columnas dentro de una
  barra lateral ya de por sí estrecha). Con nombres más largos como
  "Credicoop" no entraba y se apretaba todo. Se rediseñó apilando el
  saldo en su propia línea, alineado bajo el nombre — nunca se vuelve a
  apretar sin importar el ancho de la card, y el nombre trunca con
  `title` (tooltip) en vez de desbordar si es muy largo.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
resolver además un error nuevo de `react-hooks/static-components` en
`CategoryManager`, causado por asignar el ícono elegido a una variable
con mayúscula y usarla como JSX; se resolvió con `createElement`
directo), `npx eslint .` (misma línea base pre-existente de siempre,
nada nuevo), `npx vitest run` (**23 archivos, 97 tests**, todos
pasando).

## ✅ Retomando las 6 ideas pendientes — primera tanda (3 de 6)

Sin necesitar que el usuario cree ninguna cuenta externa:

- [x] **Exportar a PDF** (completa la idea #8) — `TransactionFilters.tsx`
  ahora tiene un botón "PDF" junto al de "CSV", usando `jspdf` +
  `jspdf-autotable`. Exporta la misma lista filtrada que ve el usuario
  (mismo criterio que el CSV), con un resumen de ingresos/gastos/balance
  arriba de la tabla. Test nuevo: verifica que el PDF respeta el filtro
  aplicado (mockeando `jspdf`/`jspdf-autotable` con `vi.mock`, ya que no
  se puede espiar un export default de un módulo ESM directamente).

- [x] **Ingreso por voz / lenguaje natural** (idea #16) —
  `src/lib/naturalLanguageExpense.ts`: parser basado en reglas/regex
  (no un modelo de IA) que reconoce el ejemplo de la idea original
  ("Gasté 8500 en coto con tarjeta") y variantes: monto (tolera formato
  argentino de miles/decimales), descripción, ingreso vs. gasto, y una
  pista de medio de pago. `VoiceExpenseInput.tsx`: botón flotante que usa
  la Web Speech API del navegador (gratis, sin API externa) para
  transcribir, o el usuario puede escribir la frase a mano si el
  navegador no la soporta (Safari, Firefox de escritorio) — en ambos
  casos, **nunca se guarda directo**: siempre se muestra una
  confirmación editable antes de guardar, porque el reconocimiento de
  voz puede equivocarse. 8 tests sobre el parser.

- [x] **Escaneo de QR de facturas AFIP** (idea #17, con un giro más
  viable que "escanear el ticket") — `src/lib/afipQr.ts`: las facturas
  electrónicas argentinas (AFIP) traen un QR que codifica una URL con un
  JSON en base64, y ese JSON **ya incluye el importe exacto** — así que
  no hace falta OCR (mucho menos confiable que leer un ticket con la
  cámara). `QrInvoiceScanner.tsx`: usa la cámara del dispositivo +
  `jsqr` para detectar el QR en vivo, decodifica el monto, y pide
  confirmar descripción/categoría antes de guardar. 5 tests sobre el
  parser del QR.

Los 3 quedaron conectados como botones flotantes apilados (calculadora
ARS/USD, calculadora normal, voz, QR — cada uno con su propio color/
ícono para distinguirse).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
reordenar una función en `QrInvoiceScanner` que se usaba antes de
declararse), `npx eslint .` (misma línea base pre-existente, nada
nuevo), `npx vitest run` (**25 archivos, 111 tests**, todos pasando).

Quedan **3 ideas**: simulador de brecha cambiaria, PWA, bot de Telegram.

## ✅ Ronda de aclaraciones y mejoras (a partir de preguntas del usuario)

El usuario hizo 3 preguntas conceptuales legítimas sobre partes que no
quedaban claras, más varios pedidos concretos. Primero las respuestas
conceptuales (reflejadas también como aclaraciones visibles en la UI):

- **"¿Los montos de Mis Billeteras no deberían verse en Balance
  Disponible?"** — Son cálculos distintos a propósito: Balance
  Disponible suma TODOS los movimientos tengan o no billetera asignada;
  el saldo de cada billetera solo cuenta lo que se le asignó
  explícitamente + su saldo inicial. Si se asigna billetera a todo,
  deberían coincidir. Se agregó un tooltip (ícono ℹ️) en la tarjeta de
  Balance Disponible explicándolo, y se muestra "En billeteras: $X"
  debajo para que sea visible de un vistazo.
- **"No veo los Gastos Hormiga"** — Bug de UX real: el componente se
  ocultaba POR COMPLETO si no detectaba gastos por debajo del umbral ese
  mes, sin avisar que existía. Ahora siempre se muestra, con un mensaje
  si no hay nada ese mes.
- **"¿Qué es el 0 de interés mensual? ¿Son chanchitos las Metas de
  Ahorro?"** — Se agregó una aclaración visible en `SavingsGoals`: es
  solo seguimiento manual (una "alcancía virtual"), no está conectado a
  ninguna billetera real, y el interés es opcional (para simular
  inversión). Tooltips en cada campo del formulario.

Y los cambios de código concretos:

- [x] **Tarjetas múltiples (Visa/Mastercard/Amex/Otra)** —
  `supabase/wallet_cards.sql`: nuevos tipos de billetera `credit_card` y
  `debit_card`, más una columna `card_network`. `WalletManager.tsx`
  ahora tiene un selector de marca cuando el tipo es tarjeta, y podés
  crear todas las que tengas (una fila por tarjeta, con nombre propio
  como "Visa Galicia", "Mastercard Naranja X").

- [x] **Editar suscripciones existentes** — `RecurringManager.tsx` se
  reescribió con un estado de formulario unificado: botón "Editar"
  (ícono lápiz) que precarga todos los campos de la suscripción
  elegida, "Guardar cambios" hace `update()` en vez de `insert()`, y un
  botón "Cancelar" para volver al modo de alta. 3 tests nuevos
  (precarga, update en vez de insert, cancelar).

- [x] **Billetera vinculada al medio de pago en Suscripciones** —
  `supabase/wallet_link_and_installment_fields.sql` agrega `wallet_id` a
  `recurring_expenses`. Al elegir "Efectivo", "Billetera Virtual",
  "Transferencia" o una tarjeta como medio de pago, aparece un selector
  con SOLO las billeteras de ese tipo que ya creaste (ej. "Efectivo" →
  solo billeteras tipo cash). Si no tenés ninguna de ese tipo, se
  avisa en vez de mostrar un selector vacío. El botón "Pagar" ahora
  también copia el `wallet_id` a la transacción generada, así el pago
  impacta el saldo de esa billetera.

- [x] **Compras en Cuotas: método de pago y notas** — mismo SQL de
  arriba agrega `payment_method` y `notes` a `installment_purchases`.
  El medio de pago elegido se usa al registrar cada cuota (antes estaba
  hardcodeado en "Tarjeta de Crédito" siempre). Las notas se muestran en
  cursiva en la card (para casos como "es una devolución a mi hermano").

- [x] **Login: mostrar/ocultar contraseña + login social** — ícono de
  ojo en el campo de contraseña. Botones de Google/Microsoft/Apple vía
  `supabase.auth.signInWithOAuth()`.
  **⚠️ Acción tuya, no puedo activarlo yo**: cada proveedor necesita
  configurarse en Supabase Dashboard → Authentication → Providers, con
  tus propias credenciales OAuth de cada plataforma (son cuentas de
  desarrollador separadas — Google Cloud Console, Azure Portal, Apple
  Developer). Hasta que actives alguno, el botón correspondiente va a
  fallar con un mensaje claro indicando el motivo. **Login por
  teléfono no se implementó**: además de activarlo en Supabase, requiere
  contratar un servicio de SMS aparte (ej. Twilio), que es un gasto
  recurrente — quedó fuera de alcance de esta sesión, avisado en la
  propia pantalla de login.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores), `npx eslint .`
(1 error nuevo real corregido — comillas dobles sin escapar en JSX en
`WalletManager`, quedó igual que el resto de la línea base pre-existente
después del fix), `npx vitest run` (**25 archivos, 114 tests**, todos
pasando).

**⚠️ 2 SQL nuevos para correr** (después de todos los anteriores, en
este orden): `wallet_cards.sql` → `wallet_link_and_installment_fields.sql`.

## ✅ Cierre de las 6 ideas pendientes — últimas 3

- [x] **Simulador de brecha cambiaria** (idea #11) —
  `supabase/net_worth_snapshots.sql`: no existía forma de saber cómo
  varió el patrimonio en pesos vs. su equivalente en USD Blue en el
  tiempo (no había datos históricos ni de cotización ni de patrimonio
  guardados). Se agregó una tabla de snapshots + `ExchangeGapSimulator.tsx`:
  botón "Tomar snapshot hoy" que guarda el balance actual junto con la
  cotización del Blue de ese día (trae la cotización de dolarapi.com,
  igual que la calculadora ARS/USD). Con 2+ snapshots, un gráfico
  compara la evolución en pesos vs. en dólares, y un resumen en texto
  ("le ganaste X% a la devaluación" / "perdiste X% de valor real").
  `computeGapSummary()` es pura y está testeada (6 tests) — durante el
  testing encontré y corregí un error de signo en mi primera versión de
  la fórmula. **Como siempre con este tipo de dato histórico**: arranca
  vacío, no hay forma de reconstruir el pasado — crece a partir de que
  tomes snapshots. **⚠️ Acción tuya**: correr `net_worth_snapshots.sql`.

- [x] **PWA** (idea #6) — se generaron los íconos (192px, 512px,
  apple-touch-icon) con el emoji 🥭 sobre fondo ámbar, `manifest.json`,
  un service worker (`public/sw.js`, estrategia network-first — los
  datos financieros siempre frescos, con la app abriendo igual sin
  conexión aunque sin datos actualizados), y se actualizó la metadata
  de `layout.tsx` (manifest, íconos, theme-color, apple-web-app). Ya se
  puede instalar como app desde el navegador ("Agregar a la pantalla de
  inicio" / el ícono de instalar en la barra de direcciones).

- [x] **Bot de Telegram** (idea #18) —
  `supabase/functions/telegram-webhook/`: Edge Function que recibe los
  mensajes del bot. Dos casos: un código de 6 dígitos vincula esa cuenta
  de Telegram con un usuario de UnMango; cualquier otro mensaje con un
  monto reconocible (ej. "Gasto 4500 café") se registra como un gasto
  real, si el chat ya está vinculado. La lógica de parseo
  (`message-parser.ts`) es la misma idea que
  `naturalLanguageExpense.ts` del frontend pero reescrita porque corre
  en Deno, un runtime aparte — 8 tests. `TelegramLink.tsx` en la app
  genera el código de vinculación (2 tests sobre `generateLinkingCode`).
  **⚠️ Esto es infraestructura lista para desplegar, no algo que yo
  pueda activar solo**: necesitás crear tu propio bot con @BotFather en
  Telegram (gratis) y configurar 2 secrets — paso a paso completo en
  `supabase/functions/telegram-webhook/README.md`.

Con esto se completaron las **20 ideas originales**: 3 ya existían, 17
se construyeron en esta sesión (algunas con alcance parcial
explícitamente documentado y justificado: temas de contraste, PWA
básica, recordatorios en dos capas).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (2 casos nuevos del mismo warning pre-existente de
"cargar al montar", nada nuevo grave), `npx vitest run` (**28 archivos,
130 tests**, todos pasando).

**⚠️ 2 SQL nuevos para correr** (después de todos los anteriores, en
este orden): `net_worth_snapshots.sql` → `telegram_links.sql`.

## ✅ Ronda de nuevos pedidos (sección Servicios/Alquiler, edición, layout)

- [x] **Sección "Servicios y Alquiler"** separada de Suscripciones —
  `supabase/recurring_kind_and_frequency.sql` agrega `expense_kind`
  ('subscription' | 'utility_rent') a `recurring_expenses`.
  `RecurringManager.tsx` ahora recibe una prop `kind` y filtra/renderiza
  según corresponda — misma mecánica (vencimientos, billetera
  vinculada, pago, edición) para las dos secciones, sin duplicar
  código. `page.tsx` renderiza el componente dos veces.

- [x] **Mensual/Anual en gastos fijos** — mismo SQL agrega
  `billing_frequency` y `billing_month`. `daysUntilNextBilling()` se
  extrajo a `src/lib/recurringBilling.ts` (antes vivía adentro del
  componente, no se podía testear) y ahora soporta ambas frecuencias —
  8 tests. `monthlyEquivalentAmount()` prorratea los gastos anuales
  (÷12) para que un seguro anual no pese como si fuera un gasto
  mensual completo en "Fijo Comprometido /mes" ni en la Proyección a
  Fin de Mes (se corrigió `MonthEndProjection.tsx` de paso, que
  tampoco reconocía el prefijo nuevo `[Servicio/Alquiler]`).

- [x] **Editar billeteras existentes** (nombre, tipo, saldo inicial,
  color, marca de tarjeta) — `WalletManager.tsx` con el mismo patrón de
  edición que ya tenía `RecurringManager` (botón lápiz, precarga el
  formulario, "Guardar cambios" hace `update()`). Test nuevo.

- [x] **Selector de íconos en columna vertical** — causa: el panel del
  popover (`PopoverPicker.tsx`) no tenía un ancho explícito, así que en
  ciertos contextos colapsaba y el `flex-wrap` de los íconos terminaba
  apilando todo en una sola columna. Se le puso un ancho mínimo/máximo
  explícito al panel, y `IconPicker.tsx` pasó a un grid de 6 columnas
  fijo (más predecible que `flex-wrap` cuando el ancho disponible es
  ambiguo).

- [x] **Header desbordando en mobile** — el header tenía 5 botones
  (tema, OLED, privacidad, compartir, salir) en una sola fila sin
  permitir que se acomodaran, más el logo/título — en pantallas
  angostas esto se desbordaba. Se cambió a `flex-col sm:flex-row` (en
  mobile el logo y los botones quedan en líneas separadas) más
  `flex-wrap` en el grupo de botones, y el texto de "Compartir balance"
  ahora se oculta en mobile (queda solo el ícono, igual que ya hacía el
  botón de privacidad).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**29 archivos, 139 tests**, todos pasando).

**⚠️ 1 SQL nuevo para correr**: `recurring_kind_and_frequency.sql`
(después de todos los anteriores).

### 📌 Pendiente de esta ronda (quedó para la próxima tanda)

- **Sección Deudas y Préstamos** — todavía no se diseñó ni implementó.
- **Sincronizar con Calendario + notificaciones** — necesita definir
  el enfoque (¿exportar archivo `.ics`? ¿integrar con Google Calendar,
  que requiere que el usuario configure OAuth como con el login
  social? ¿notificaciones push del navegador, más simples pero solo
  funcionan con la app abierta/en background reciente?) antes de
  empezar a construir.
- **Recordatorio pendiente para el usuario**: retomar el troubleshooting
  del bot de Telegram (`getWebhookInfo`, revisar logs de la Edge
  Function) la próxima vez que esté en la computadora.

## ✅ Deudas y Préstamos

- [x] **Nueva sección** — `supabase/debts.sql` (tablas `debts` y
  `debt_payments`, con RLS). `DebtsManager.tsx`: registrás si "Yo debo"
  o "Me deben" plata, con quién, monto, moneda, fecha límite opcional,
  interés opcional, y notas libres (ej. "acordamos pagar en 3 cuotas").
  Barra de progreso de pago/cobro, aviso si está vencida. El botón
  "Registrar pago"/"Registrar cobro" actualiza el saldo restante Y
  genera una transacción real (gasto si pagás una deuda, ingreso si te
  pagan un préstamo) — mismo patrón que ya usan Suscripciones y Cuotas.
  Las deudas saldadas se pueden ocultar/mostrar en una sección
  colapsada aparte. `computeDebtProgress()` y `daysOverdue()` puras,
  testeadas (8 tests).
  **⚠️ Acción tuya**: correr `debts.sql`.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (1 caso nuevo del mismo warning pre-existente, nada
nuevo grave), `npx vitest run` (**30 archivos, 147 tests**, todos
pasando).

**⚠️ 1 SQL nuevo para correr**: `debts.sql`.

## ✅ Google Calendar (OAuth real, decisión explícita del usuario)

El usuario prefirió integración real con Google Calendar por sobre el
feed `.ics` suscribible que había propuesto — más trabajo de
configuración (Google Cloud Console + OAuth), pero eventos reales con
recordatorios nativos de Google Calendar en vez de depender de que el
calendario refresque un feed cada 12-24hs.

- [x] `supabase/google_calendar_sync.sql` — tabla
  `google_calendar_tokens` (guarda el refresh_token de Google de cada
  usuario) y `google_calendar_events` (mapea cada suscripción/servicio
  con el ID del evento creado en Google, para actualizar en vez de
  duplicar en cada sincronización — ya preparada con `source_table`
  aceptando también `'installment_purchases'` y `'debts'` para cuando
  se sumen esos alcances).
- [x] `GoogleCalendarLink.tsx` — botón "Conectar Google Calendar"
  (`signInWithOAuth` con scope `calendar.events` + `access_type=offline`
  + `prompt=consent`, necesario para que Google devuelva un
  refresh_token reutilizable). Al volver del login, un listener de
  `onAuthStateChange` captura `provider_refresh_token` de la sesión y
  lo guarda — Supabase no lo persiste por su cuenta. Botón "Sincronizar
  ahora" + "Desconectar".
- [x] `supabase/functions/sync-google-calendar/` — Edge Function que
  identifica al usuario por su JWT (a diferencia de
  `send-renewal-reminders`/`telegram-webhook`, esta SÍ requiere sesión
  válida, la llama el usuario desde la app), refresca el access_token
  de Google con el refresh_token guardado, y crea/actualiza un evento
  de Google Calendar por cada suscripción/servicio activo (día
  completo, con recordatorios 3 días y 1 día antes). La lógica de
  "próximo vencimiento" y armado del evento
  (`calendar-event.ts`) es Deno-portable, sin nada de Deno, para poder
  testearla con Vitest — 7 tests.
  **⚠️ Acción tuya**: seguir el README de esa carpeta — habilitar la
  Calendar API, agregar el scope a la pantalla de consentimiento,
  configurar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` como secrets de
  la función (mismas credenciales que ya tenés en Supabase Auth, pero
  hay que dárselas también acá), y desplegar con
  `supabase functions deploy sync-google-calendar` (sin
  `--no-verify-jwt`, a diferencia de las otras dos funciones).

**Alcance de esta primera versión**: sincroniza Suscripciones y
Servicios/Alquiler (tienen vencimiento recurrente claro). Cuotas y
Deudas quedan para una siguiente vuelta — el schema ya las contempla.
La sincronización es manual (botón), no automática por cron — se
podría agregar más adelante con una adaptación (esta función valida
JWT de usuario, un cron no puede invocarla de la misma forma que
`send-renewal-reminders`).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (1 caso nuevo del mismo warning pre-existente, nada
nuevo grave), `npx vitest run` (**31 archivos, 154 tests**, todos
pasando).

**⚠️ 1 SQL nuevo para correr**: `google_calendar_sync.sql`.

---
_Generado en sesión de auditoría con Claude — 29/07/2026._

## 🎨 Rediseño a navegación por pestañas (a partir de brief de Gemini Code)

El usuario compartió un documento de rediseño completo (armado con otra
IA) y decidió avanzar con la parte más grande primero: reestructurar
toda la app de una sola página que scrollea a navegación tipo app
mobile con pestañas. Se está haciendo en 4 pasos; este es el paso 1.

### ✅ Paso 1: Shell de navegación

- [x] **`BottomNav.tsx`** (`src/components/nav/`) — barra inferior fija
  con 4 pestañas (Inicio, Análisis, Planes, Historial), con un hueco
  reservado en el medio para el FAB central que se suma en el paso 3
  (así no hay que reacomodar el layout de nuevo). 3 tests.
- [x] **`SettingsPanel.tsx`** — overlay a pantalla completa para
  Configuración, accesible desde un ícono nuevo en el header (⚙️) en
  vez de ser una sección más mezclada en el medio de la página, como
  pedía el documento ("mover Ajustes a un ícono en la barra superior").
- [x] **`page.tsx` reorganizado** en las 4 pestañas:
  - **Inicio**: tarjetas de Balance/Ingresos/Gastos, Días sin Gastar,
    Proyección a Fin de Mes, Gastos Hormiga, Alerta de aumento de
    precio, y el formulario de carga rápida.
  - **Análisis**: gráfico de torta, Tendencia 6 meses, Brecha
    Cambiaria, Regla 50/30/20.
  - **Planes**: Pagos Recurrentes, Cuotas, Deudas y Préstamos,
    Presupuestos, Metas de Ahorro.
  - **Historial**: lo que ya existía (filtros + lista), sin cambios.
  - **Configuración** (no es una pestaña, es el overlay): Importar
    CSV, Mis Billeteras, Mis Categorías, Copia de Seguridad, Telegram,
    Google Calendar.
- [x] Los 4 botones flotantes (calculadora ARS/USD, calculadora normal,
  voz, QR) se subieron para no quedar tapados por la barra inferior
  nueva — es un ajuste temporal, el paso 3 los reemplaza por el FAB
  desplegable central.

Unificar Suscripciones+Servicios/Alquiler en "Pagos Recurrentes" (parte
del mismo documento) ya se había hecho en la tanda anterior.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — si hubiera
quedado un tag JSX desbalanceado en la reorganización, esto lo habría
marcado como error de sintaxis), `npx eslint .` (misma línea base
pre-existente, nada nuevo), `npx vitest run` (**34 archivos, 166
tests**, todos pasando).

### 📌 Quedan 2 pasos de este rediseño (al momento del Paso 1)

- **Paso 2**: pulir cada pestaña (ej. "Últimos Movimientos" resumido en
  Inicio, tabla Oficial/Blue/MEP en vez de solo Blue en Brecha
  Cambiaria — hoy solo hay dato de Blue).
- **Paso 3**: FAB central desplegable que reemplace los 4 botones
  flotantes sueltos por un solo botón `[+]` con las 4 opciones (Voz,
  QR, Calculadora ARS/USD, Carga Manual).
- **Paso 4**: piezas nuevas del documento — calculadora matemática
  inline en el campo de monto (que "2500 + 1300" calcule solo),
  carrusel horizontal de billeteras en Inicio, Límite Seguro de Gasto
  Diario, Simulador Contado vs. Cuotas, división de gastos con
  recordatorio por WhatsApp.

## ✅ Paso 2: pulir cada pestaña

- [x] **Gastos Hormiga movido de Inicio a Análisis** — el documento
  original lo pone en la pestaña de Análisis (junto con la Regla
  50/30/20 y la Tendencia), no en Inicio; en el paso 1 había quedado
  mal ubicado por apuro.
- [x] **"Últimos Movimientos" en Inicio** — `RecentTransactions.tsx`:
  vista resumida de los últimos 5 movimientos (reutiliza los datos que
  ya se cargan para el historial, no pide nada nuevo a la base), con un
  link "Ver todo" que te lleva directo a la pestaña Historial.
- [x] **Tabla Oficial/Blue/MEP en Análisis** — `DollarRatesTable.tsx`:
  antes solo existía el dato de Blue (usado en la calculadora ARS/USD y
  en el simulador de Brecha Cambiaria histórica). Ahora se agregó esta
  tarjeta con las 3 cotizaciones de referencia (Oficial/Blue/MEP,
  compra y venta) más el % de brecha Blue vs. Oficial, todo desde
  `dolarapi.com` (mismo proveedor sin API key que ya se usaba).
  `computeRateGapPercent()` pura, testeada (4 tests) — se verificaron
  los endpoints reales de la API antes de escribir el código (`GET
  /v1/dolares` trae todo de una).
- [x] **Ícono de ojo en la tarjeta de Balance** — antes el toggle de
  privacidad solo estaba en el header; ahora también hay un ícono
  directo en la tarjeta de Balance Disponible (mismo `togglePrivacy`,
  solo más visible/conveniente ahí, tal como pedía el documento).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (1 caso nuevo del mismo warning pre-existente, nada
nuevo grave), `npx vitest run` (**35 archivos, 170 tests**, todos
pasando).

## ✅ Paso 3: FAB central desplegable

- [x] **`SpeedDialFab.tsx`** (`src/components/nav/`) — reemplaza los 4
  botones flotantes sueltos (uno por función) por un solo botón `[+]`
  centrado que, al tocarlo, despliega las 4 opciones hacia arriba:
  Carga Manual, Calculadora ARS/USD, Escanear QR, Cargar por Voz. Elegir
  una cierra el menú y dispara esa acción. 4 tests.
- [x] **3 componentes convertidos a "controlados"** — `ArsUsdCalculator`,
  `VoiceExpenseInput` y `QrInvoiceScanner` ya no manejan su propio botón
  flotante ni su propio estado de apertura: ahora reciben `isOpen` +
  `onClose` como props, y quien decide cuándo abrirlos es el
  `SpeedDialFab`. La lógica interna de cada uno (parseo de voz, cámara
  QR, conversión ARS/USD) no cambió, solo cómo se abren/cierran.
- [x] **"Carga Manual" no duplica el formulario** — en vez de abrir un
  modal más con una copia de `TransactionForm`, la opción del FAB lleva
  a la pestaña Inicio (donde el formulario ya está siempre visible) y
  enfoca el campo de descripción — mismo comportamiento que ya tenía el
  atajo de teclado "N".
- [x] **Calculadora normal eliminada** — el documento pide sacarla
  explícitamente ("Elimina la calculadora flotante estándar e integra
  soporte de operaciones matemáticas en el input"). Se borró
  `BasicCalculator.tsx` y su test, pero se **mantuvo**
  `src/lib/basicCalculator.ts` (la función pura `applyOperator`) porque
  el paso 4 la va a reutilizar para la matemática inline en el campo de
  monto — no tenía sentido tirar esa lógica si se va a necesitar de
  nuevo en el próximo paso.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**35 archivos, 172 tests**, todos pasando — bajó de
170 a 172 porque se sumaron los 4 tests del FAB pero se sacaron los 2
del componente de calculadora normal eliminado).

### 📌 Queda 1 paso de este rediseño

- **Paso 4**: piezas nuevas del documento — calculadora matemática
  inline en el campo de monto (que "2500 + 1300" calcule solo,
  reutilizando `applyOperator` de `basicCalculator.ts`), carrusel
  horizontal de billeteras en Inicio, Límite Seguro de Gasto Diario,
  Simulador Contado vs. Cuotas, división de gastos con recordatorio por
  WhatsApp.

## 🚧 Paso 4 (en progreso) — 3 de 5 piezas nuevas

- [x] **Matemática inline en el campo de monto** — el documento pedía
  que "2500 + 1300" calcule solo al cargar un movimiento.
  `evaluateMathExpression()` en `basicCalculator.ts` (reutiliza
  `applyOperator`, respeta precedencia ×÷ antes que +−, nunca usa
  `eval()`) — 16 tests. El campo de monto en `TransactionForm` pasó de
  `type="number"` (que ni siquiera dejaba tipear `+`) a texto con
  teclado numérico en mobile; evalúa al perder foco, con una red de
  seguridad al enviar por si se manda con Enter sin salir del campo, y
  valida que el resultado sea un número válido antes de guardar (ya no
  hay validación nativa del navegador al no ser `type="number"`).
- [x] **Carrusel horizontal de billeteras en Inicio** —
  `WalletCarousel.tsx`: vista de solo lectura (desliza horizontal,
  `overflow-x-auto` + `snap`), reutiliza la misma consulta de saldos
  que ya usaba `WalletManager` (`get_wallet_balances`). La gestión
  completa (crear/editar/eliminar) sigue en Configuración — esto es
  solo un vistazo rápido en Inicio.
- [x] **Límite Seguro de Gasto Diario** — `SafeToSpendWidget.tsx`:
  "Podés gastar hoy hasta $X sin salirte de tu presupuesto".
  `computeSafeToSpend()` pura (balance disponible menos gastos fijos
  comprometidos del mes, dividido entre los días que quedan — nunca da
  negativo) — 4 tests.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
agrupar con paréntesis un `??` mezclado con `||` en
`WalletCarousel.tsx`, TypeScript no permite mezclarlos sin agrupar),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**36 archivos, 187 tests**, todos pasando).

Quedan 2 piezas del paso 4: Simulador Contado vs. Cuotas
(anti-inflación) y división de gastos con recordatorio por WhatsApp.

## ✅ Paso 4 (completo) — últimas 2 piezas

- [x] **Simulador Contado vs. Cuotas** — `InstallmentsVsCashSimulator.tsx`
  (botón dentro de Cuotas, en Planes). `compareInstallmentsVsCash()`
  pura: descuenta cada cuota futura a valor presente según la
  inflación mensual que el usuario estima, y compara esa suma contra el
  precio de contado — si el valor presente financiado es menor,
  conviene financiar; si es mayor, conviene contado. Aclara
  explícitamente que no es asesoramiento financiero, es una cuenta
  simple con una tasa estimada por el usuario. 4 tests.
- [x] **Dividir Gasto + WhatsApp** — `SplitExpenseTool.tsx` (botón
  dentro de Deudas y Préstamos, en Planes). Divide un monto entre N
  personas, y si cargás el nombre de la otra persona, además **crea una
  deuda "me deben"** en Deudas y Préstamos por su parte (se integra con
  la sección que ya existía, no es un cálculo aislado que se pierde).
  Botón "Enviar por WhatsApp" arma un link `wa.me` con el mensaje
  precargado (monto + alias bancario opcional) — si no hay teléfono
  cargado, abre el selector de contacto de WhatsApp para elegir a quién
  mandárselo. `computeSplitShare()`, `buildSplitExpenseMessage()`,
  `buildWhatsAppLink()` puras, testeadas (9 tests).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**38 archivos, 200 tests**, todos pasando).

## 🎉 Rediseño completo (4/4 pasos)

Con esto se terminaron los 4 pasos del rediseño basado en el brief que
el usuario compartió: navegación por pestañas (Inicio/Análisis/Planes/
Historial + Configuración como overlay), pulido de cada pestaña, FAB
central desplegable, y las 5 piezas nuevas (matemática inline,
carrusel de billeteras, Límite Seguro de Gasto Diario, Simulador
Contado vs. Cuotas, Dividir Gastos + WhatsApp). Quedó además una
auditoría completa de responsive mobile con 7 problemas reales
corregidos.

## ✅ Auditoría de diseño responsive mobile (análisis estático)

El usuario pidió una revisión completa de que todo entre en pantalla en
mobile. **Aclaración de método**: no hay acceso de red en este sandbox
a los dominios que necesita Playwright para bajar un navegador real
(se intentó `npx playwright install chromium`, falló por la lista de
dominios permitidos) — así que esto NO es una verificación visual con
capturas reales, es una revisión sistemática del código (clases de
Tailwind, patrones de `flex`/`grid`) buscando los patrones que
típicamente causan desborde horizontal en pantallas de 320-375px.
Encontró y corrigió **7 problemas reales**:

- [x] **Historial de Movimientos** (`page.tsx`) — la fila de cada
  transacción no protegía contra descripciones largas: sin `truncate`
  ni `min-w-0`, un texto largo empujaba el monto y el botón de borrar
  fuera de la fila. Se separó en un lado izquierdo que se achica y
  trunca (`min-w-0 flex-1`) y un lado derecho que nunca se aprieta
  (`shrink-0`) — mismo patrón que ya se usaba bien en
  `RecentTransactions.tsx`.
- [x] **`PopoverPicker.tsx`** (selector de color/ícono) — el panel se
  abría siempre extendiéndose hacia la derecha del botón sin límite
  relativo a la pantalla; en un trigger ya cercano al borde derecho
  (como en Mis Categorías), se cortaba. Se alineó a la derecha del
  trigger (se extiende hacia la izquierda en vez de hacia la derecha) y
  se limitó el ancho máximo a `calc(100vw - 2rem)`.
- [x] **Header de "Pagos Recurrentes / Vencimientos"** — título largo +
  caja de resumen a la derecha en una sola fila sin `flex-wrap`: en
  320-375px esto se corta directamente. Se agregó `flex-wrap gap-2`
  (mismo fix aplicado también, de forma preventiva, a los headers de
  `BudgetManager` y `WalletManager`, que tienen el mismo patrón
  título+resumen aunque con títulos más cortos y por ende menor riesgo).
- [x] **Banners "Editando..."** (`RecurringManager`, `WalletManager`) —
  el nombre de lo que se está editando no truncaba; si es largo,
  empujaba el botón "Cancelar" fuera de la barra. Se truncó el texto en
  vez de envolverlo (mejor UX en una barra angosta que reacomodarse).
- [x] **Tabla de preview de importación CSV** (`ImportTransactions.tsx`)
  — 4 columnas de datos reales (Fecha/Descripción/Monto/Tipo) sin
  scroll horizontal; solo tenía scroll vertical. Se agregó
  `overflow-x-auto` + un ancho mínimo a la tabla, para que scrollee
  hacia los costados en vez de romper el layout de la página.
- [x] **Card de cada meta de ahorro y cada presupuesto** — el nombre de
  la meta/categoría no truncaba contra los botones de acción. Mismo fix
  que el Historial: truncar + `shrink-0` en los botones.
- [x] **Card de cada compra en cuotas** — dos problemas: la descripción
  sin truncar arriba, y la fila de progreso ("X de Y cuotas pagadas —
  $monto total") + el botón "Pagar cuota N (\$monto)" abajo, ambos con
  texto dinámico largo, sin `flex-wrap`. Se corrigieron los dos.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**36 archivos, 187 tests**, todos pasando — estos
cambios son solo de clases CSS/estructura, no tocan lógica, por eso no
se agregaron tests nuevos).

**Limitación honesta de este trabajo**: sin poder correr un navegador
real en este sandbox, quedan afuera de esta pasada los problemas que
solo aparecen con contenido real específico (ej. un nombre de
categoría particularmente largo con caracteres que no cortan bien) o
que dependen del renderizado real de fuentes/anchos exactos del
dispositivo. Si al probarlo en tu celular encontrás algo que se sigue
cortando, mandame captura como las anteriores y lo reviso puntual.

## ✅ Nueva batería de ideas — Top 3 prioritarias del usuario

El usuario compartió un documento con 14 ideas nuevas organizadas en 4
categorías, con un resumen explícito de "Top 3 para implementar
primero". Se implementaron en ese orden:

- [x] **Costo en Horas de Trabajo** — `supabase/user_work_settings.sql`
  (ingreso mensual + horas trabajadas por mes, con RLS).
  `computeHoursOfWork()` pura (4 tests): calcula el valor hora y
  traduce cualquier monto a horas + jornadas de 8hs equivalentes.
  `WorkSettings.tsx` en Configuración para cargarlo una sola vez (es
  opcional — si no está configurado, el hint simplemente no aparece).
  En `TransactionForm`, debajo del campo de monto, se muestra en vivo
  "Esto te cuesta X.Xh de trabajo (X.X jornadas)" para gastos en ARS —
  reevalúa también si el campo tiene una expresión matemática como
  "2500 + 1300".

- [x] **Un Mango Score** — `computeFinancialHealthScore()` pura (6
  tests): puntaje de 0 a 100 con 4 pilares al 25% cada uno (Ahorro,
  Deuda, Fondo de Emergencia, Gasto Hormiga). `FinancialHealthScoreWidget.tsx`
  en Inicio: anillo de progreso SVG con el score total + una barra por
  pilar. Aclara explícitamente que no es un puntaje crediticio ni un
  consejo financiero.

- [ ] **Modo Hogar/Pareja** — la más grande de las 3, todavía sin
  empezar. Requiere vincular dos cuentas de UnMango distintas y
  calcular un balance compartido entre usuarios — queda para una
  próxima tanda dedicada.

Verificado en este sandbox (ambas piezas): `npx tsc --noEmit` (0
errores), `npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**40 archivos, 210 tests**, todos pasando).

## ✅ Fix: "cargar cualquier dato nuevo me manda al principio de la página"

Bug real reportado por el usuario. Causa: 4 componentes
(`WalletManager`, `RecurringManager`, `SavingsGoals`, `BudgetManager`)
usaban `window.scrollTo({ top: 0 })` al **editar** un ítem existente (o
al aplicar una meta/presupuesto sugerido) — eso desplaza **toda la
ventana** hasta el borde superior absoluto de la página, no solo hasta
el principio de esa tarjeta. En pestañas con varias tarjetas apiladas
(como Planes), esto se sentía como "me mandó al principio de todo".

Se reemplazó por `scrollIntoView({ block: 'start' })` sobre un `ref` al
contenedor raíz de cada componente — ahora desplaza solo lo necesario
para que esa tarjeta puntual quede visible, sin saltar por encima de
todo lo demás.

De paso se encontró que `Element.prototype.scrollIntoView` no existe
en absoluto en jsdom (a diferencia de `window.scrollTo`, que existe
pero solo tira un warning) — los tests que editan un ítem tiraban un
error de fondo aunque las aserciones pasaran igual. Se agregó un mock
mínimo en `vitest.setup.ts` (es una API estándar bien soportada en
navegadores reales, esto es solo una limitación del entorno de test).

Verificado: `npx tsc --noEmit` (0 errores), `npx eslint .` (misma
línea base pre-existente, nada nuevo — de hecho 2 archivos salieron de
la lista de warnings pre-existentes), `npx vitest run` (**40 archivos,
210 tests**, todos pasando, sin errores de fondo esta vez).

## ✅ Arquitectura Offline-First (adaptada a Supabase, MVP)

El usuario compartió un documento con el concepto completo (Service
Worker + IndexedDB + cola de pendientes + sincronización automática),
pero escrito para un backend REST propio (`/api/transacciones`,
`/api/transacciones/sync-batch`) que **no existe en este proyecto** —
acá se llama a Supabase directo desde el cliente, sin backend propio.
Se adaptó el concepto (no se copió el código tal cual) a la
arquitectura real:

- [x] **Service Worker**: ya existía desde la Fase de PWA
  (`public/sw.js`, network-first con fallback a cache) — cubre la parte
  de "la app carga instantáneo sin internet y se puede instalar", no
  hizo falta rehacerlo.
- [x] **Cola de pendientes** — `src/lib/offlineQueueLogic.ts`:
  `addToQueue()`/`removeFromQueue()` puras (6 tests) sobre un array, sin
  tocar storage. `src/lib/offlineQueue.ts`: wrapper de I/O sobre
  `localStorage` (se usa localStorage en vez de IndexedDB — el volumen
  de datos de esto es chico, no justifica esa complejidad extra).
- [x] **`OfflineSyncManager.tsx`**: montado una vez en `page.tsx`, sin
  UI visible salvo cuando hay algo que mostrar. Escucha los eventos
  `online`/`offline` del navegador (como pedía el documento) y, al
  recuperar conexión, sincroniza automáticamente todo lo que había
  quedado pendiente, insertándolo de verdad en Supabase (en vez de un
  endpoint `/sync-batch` que no existe acá). Muestra un banner arriba
  de todo: ámbar mientras estás offline, azul mientras sincroniza, gris
  si quedó algo sin sincronizar por algún error real (no de conexión).
- [x] **`TransactionForm.tsx`**: si `navigator.onLine` es `false` antes
  de intentar guardar, ni intenta pegarle a Supabase — va directo a la
  cola. Si el insert falla y en ese momento ya no hay conexión (se
  cortó a mitad de camino), también se encola en vez de mostrar un
  error que asuste al usuario; si falla por otro motivo (dato
  inválido, etc.) sí se muestra el error real, sin ocultarlo.

**Alcance de este MVP — importante ser honesto**: por ahora **solo
`TransactionForm` (Carga Manual) tiene esto integrado** — es el caso de
uso más común (cargar un gasto en el momento, sin señal). Las demás
pantallas (Suscripciones, Cuotas, Deudas, Metas, etc.) todavía
requieren conexión para guardar; extenderles el mismo patrón es
mecánico (mismo `enqueueOfflineTransaction`-style helper, adaptado a
cada tabla) pero no se hizo en esta pasada por alcance/tiempo. Tampoco
hay lectura offline de datos ya guardados (ver el historial sin
conexión) — el Service Worker cachea el *shell* de la app, no los datos
de Supabase.

Verificado: `npx tsc --noEmit` (0 errores — hubo que tipar
explícitamente el insert de sincronización, igual que en
`BackupRestore.tsx`, porque TypeScript no puede verificar los campos
requeridos a través de un `Record<string, unknown>` genérico),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**41 archivos, 216 tests**, todos pasando).

## ✅ Modo Hogar / Pareja (3ra idea prioritaria, completa)

La más grande de las 3 ideas prioritarias que el usuario marcó como
"para implementar primero". Vincula dos cuentas de UnMango distintas
para llevar los gastos comunes de la casa sin mezclarlos con lo
personal de cada uno.

- [x] **`supabase/household_mode.sql`** — `household_links` (vincula
  dos `user_id`, con un código de invitación de 8 caracteres sin
  ambigüedad tipo 0/O/1/I) y `household_expenses` (gastos compartidos,
  con RLS que solo deja ver/insertar/borrar a quien pertenece a ese
  hogar). **Aceptar una invitación NO es un UPDATE directo del
  cliente** — es una función `security definer`
  (`accept_household_invite`) que solo permite la operación exacta
  "completar `user_b_id` con tu propio `auth.uid()` en una invitación
  pendiente que no sea la tuya", en vez de una policy de RLS de UPDATE
  más difícil de acotar columna por columna. También hay una función
  `get_household_partner_email` (también `security definer`, porque un
  usuario común no puede leer `auth.users` de nadie más) para poder
  mostrar el email de la otra persona sin exponer una consulta directa
  a esa tabla.
- [x] **`computeHouseholdBalance()`** (`src/lib/householdBalance.ts`,
  pura, 5 tests) — cada uno debería haber puesto la mitad del total de
  gastos de hogar; si pagaste de más, la otra persona te debe la
  diferencia, si pagaste de menos, se la debés vos.
- [x] **`generateHouseholdInviteCode()`** (pura, 3 tests) — código de 8
  caracteres, más largo que el de Telegram (6 dígitos) a propósito: acá
  se comparte acceso a datos financieros de dos cuentas, conviene que
  sea menos adivinable.
- [x] **`HouseholdLink.tsx`** (vive en Configuración, mismo lugar que
  Telegram/Google Calendar): generar código para invitar, o cargar un
  código que te pasaron para unirte. Mientras está "pending" (generaste
  el código pero la otra persona todavía no lo cargó), se puede
  cancelar. Una vez activo, muestra el email de la otra persona y un
  botón para desvincular (con confirmación, porque borra los gastos
  compartidos).
- [x] **`HouseholdExpenses.tsx`** (vive en Planes, junto a Pagos
  Recurrentes/Cuotas/Deudas) — **se oculta sola si no hay hogar
  vinculado**, no aparece una tarjeta vacía confundiendo a quien no usa
  esto. Registra gastos de hogar (quién pagó se infiere de quién está
  logueado), muestra el balance ("Fulano te debe $X" / "Le debés a
  Fulano $X"), y un botón "Marcar como saldado" que borra todo el
  historial de gastos de hogar para arrancar de cero (pensado para
  usar después de arreglar cuentas en la vida real — no mueve plata
  real entre las cuentas, es un cálculo, no una transferencia).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (2 casos nuevos del mismo warning pre-existente, nada
nuevo grave), `npx vitest run` (**43 archivos, 224 tests**, todos
pasando).

**⚠️ 1 SQL nuevo para correr**: `household_mode.sql`.

Con esto se completaron las **3 ideas prioritarias** de la nueva
batería que el usuario compartió.

## ✅ Recomendaciones Financieras (a partir de una pregunta del usuario)

El usuario preguntó si había alguna feature que mostrara la situación
financiera con consejos según gastos/ingresos/suscripciones/etc. La
respuesta era "a medias" — el Un Mango Score ya mostraba los números,
pero no traducía eso a consejos en texto. Se construyó ese hueco:

- [x] **`generateFinancialAdvice()`** (`src/lib/financialAdvice.ts`,
  pura, 7 tests) — motor de consejos basado en reglas (no IA) sobre los
  mismos 4 pilares del Un Mango Score, para que los consejos nunca
  contradigan lo que ya se ve ahí. Cada pilar solo genera un consejo si
  está fuera de un rango saludable (no satura con 4 consejos genéricos
  cuando todo está bien) — incluye avisos positivos también cuando algo
  va muy bien, no solo alertas. Suma dos señales más: si alguna
  suscripción subió de precio (reutiliza `detectPriceIncreases()`, ya
  existente) y si el Límite Seguro de Gasto Diario ya llegó a 0
  (reutiliza `computeSafeToSpend()`, ya existente).
- [x] **`FinancialAdviceWidget.tsx`** — en Inicio, justo debajo del Un
  Mango Score. Si no hay ninguna alerta puntual, lo dice explícitamente
  ("tus números están en un rango razonable") en vez de no mostrar
  nada, para que quede claro que sí se revisó. Aclara que son consejos
  basados en reglas simples, no asesoramiento financiero profesional.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**44 archivos, 231 tests**, todos pasando).

## ✅ 4 correcciones a partir de capturas del usuario

- [x] **Categorías sugeridas se creaban duplicadas** — bug real
  confirmado en las capturas (14 de las 15 categorías sugeridas
  aparecían dos veces). Causa: `setLoadingSuggested(true)` deshabilita
  el botón recién cuando React re-renderiza, que no es inmediato — en
  un doble-tap en mobile (`touchend` + `click` disparando casi juntos)
  podían arrancar dos ejecuciones de `handleAddSuggested` antes de que
  el `disabled` surtiera efecto en el DOM, y las dos partían de la
  misma lista de "categorías ya existentes" (ninguna todavía insertada
  por la otra). Se agregó un guard sincrónico con `useRef` — no
  depende de un re-render, frena la segunda ejecución al toque.
- [x] **Doble barra de scroll en Configuración** — el panel
  (`SettingsPanel.tsx`) es `fixed inset-0 overflow-y-auto`, pero el
  `<body>` de atrás seguía siendo scrolleable aunque estuviera tapado
  por el overlay, mostrando sus dos barras al mismo tiempo. Se bloquea
  `document.body.style.overflow` mientras el panel está abierto, y se
  restaura al cerrar.
- [x] **FAB con las opciones apiladas verticalmente** — el usuario pidió
  que rodeen el botón central en vez de alinearse en columna, con
  animación. Rediseñado en `SpeedDialFab.tsx`: las 4 opciones ahora se
  abren en abanico sobre un arco semicircular arriba del `[+]`
  (calculado con trigonometría — ángulos de 160° a 20°, radio 92px),
  con una animación de escala + traslado escalonada por índice (40ms de
  delay entre cada una). El botón central también rota entre el ícono
  `+` y `X` con una transición cruzada. Las opciones ahora quedan
  siempre montadas en el DOM (antes se montaban/desmontaban de golpe
  con `dialOpen && (...)`, lo que hacía que el cierre fuera instantáneo
  sin transición) — se ocultan con `opacity-0 pointer-events-none` +
  `aria-hidden`, así también el cierre anima. Tests actualizados para
  reflejar esto (antes chequeaban "no está en el DOM", ahora chequean
  `aria-hidden`).
- [x] **Tarjetas de billeteras: editar y eliminar separados** —
  confirmado en la captura: la fila tenía 3 hijos
  (`monto`, `botón editar`, `botón eliminar`) con `justify-between`,
  que reparte el espacio POR IGUAL entre cada par de hijos consecutivos
  — por eso "Editar" quedaba a mitad de camino en vez de al lado de
  "Eliminar". Se agruparon los dos botones en su propio contenedor
  (`flex gap-0.5`), dejando `justify-between` con solo 2 grupos (monto
  a la izquierda, botones juntos a la derecha). De paso, algunas mejoras
  visuales pedidas ("alguna recomendación"): una franja de color a la
  izquierda de la card con la identidad de cada billetera (antes solo
  el ícono tenía color), targets táctiles más grandes en los botones
  (`p-1.5` en vez de `p-1`, con fondo de color al hacer hover para mejor
  feedback), y un hover sutil en toda la card.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**44 archivos, 231 tests**, todos pasando).

## ✅ Mejoras a Carga por Voz (a pedido del usuario)

Revisando el código a fondo para esta mejora se encontró un **bug real
no reportado**: el medio de pago se detectaba (`paymentMethodHint` en
`naturalLanguageExpense.ts`) pero **nunca se usaba** — el insert
siempre guardaba `payment_method: 'Efectivo'` fijo, sin importar lo que
la persona dijera ("con tarjeta", "por transferencia", etc.). Se
corrigió de raíz, con un test que reproduce el bug (falla en la versión
vieja, pasa en la nueva).

- [x] **Medio de pago corregido** — ahora se usa de verdad
  `paymentMethodHint`, y además se agregó **selección de billetera**:
  si hay una sola billetera del tipo correspondiente al medio de pago
  detectado (ej. una sola tarjeta de crédito), se preselecciona sola;
  si hay varias, el usuario elige.
- [x] **Categorización automática** — `src/lib/expenseCategoryGuess.ts`
  (`guessCategoryName()`, pura, 6 tests): reconoce comercios/rubros
  comunes de Argentina (Coto/Carrefour/Jumbo → Supermercado, YPF/nafta
  → Transporte, PedidosYa/Rappi → Restaurantes y Delivery, Netflix/
  Spotify → Entretenimiento, etc.) y cruza el nombre con las categorías
  reales que el usuario ya tiene creadas — si no tiene esa categoría,
  no inventa una, la deja sin categorizar para que la elija a mano.
- [x] **Transcripción en vivo mientras hablás** — antes había que
  esperar en silencio hasta que el reconocimiento terminara de
  procesar todo; ahora se activó `interimResults: true` y se muestra el
  texto parcial a medida que se va reconociendo, para que quede claro
  que el micrófono está funcionando.
- [x] **Mensajes de error reales** — antes cualquier error (sin
  permiso de micrófono, sin micrófono conectado, sin internet — el
  reconocimiento de Chrome usa un servicio en la nube, no es 100%
  local) fallaba en silencio, dejando a la persona sin saber qué pasó.
  `src/lib/speechErrorMessage.ts` (pura, 5 tests) traduce los códigos
  de error de la Web Speech API a mensajes en español que dicen qué
  hacer al respecto.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**47 archivos, 245 tests**, todos pasando).

## ✅ Consejos accionables + Ordenar/Filtrar en Planes

- [x] **Recomendaciones accionables** — cada consejo del panel de
  Inicio ahora puede llevar un botón "Crear una Meta de Ahorro →" /
  "Ver Pagos Recurrentes →" / "Ver detalle en Análisis →" que cambia de
  pestaña y hace scroll directo a esa sección. `AdviceAction` nuevo en
  `financialAdvice.ts` (tab + sectionId opcional), mapeado a cada tipo
  de consejo — los positivos ("vas bien") no llevan acción, no hay nada
  que "hacer" ahí. Se agregaron `id`s a los contenedores de
  `SavingsGoals` ("metas-ahorro"), `RecurringManager`
  ("pagos-recurrentes"), `AntExpenses` ("gastos-hormiga") y
  `SafeToSpendWidget` ("safe-to-spend") para que el scroll tenga a
  dónde apuntar. 10 tests (3 nuevos sobre las acciones).
- [x] **Ordenar/Filtrar en Mis Billeteras** — por nombre, saldo o tipo,
  ascendente/descendente, más filtro por tipo de billetera.
  `sortWallets()`/`filterWalletsByType()` puras (7 tests).
- [x] **Evaluación de las otras 3 secciones — se agregó a las 3**:
  - **Pagos Recurrentes**: ordenar por vencimiento/nombre/monto, filtrar
    por Suscripción/Servicio. `sortRecurringExpenses()`/
    `filterRecurringByKind()` (5 tests).
  - **Deudas y Préstamos**: ordenar por vencimiento/nombre/monto
    restante (las sin fecha de vencimiento siempre van al final,
    ordenando en cualquier sentido), filtrar por Debo/Me deben.
    `sortDebts()`/`filterDebtsByType()` (6 tests).
  - **Compras en Cuotas**: ordenar por nombre/monto total. Se evaluó
    agregar "cuotas restantes" como campo de orden pero hubiera
    necesitado pasar un mapa extra de pagos desde afuera solo para
    eso — nombre y monto cubren el caso de uso principal sin esa
    complejidad. `sortInstallmentPurchases()` (3 tests, genérica para
    preservar el tipo extendido `PurchaseWithPayments` que usa el
    componente).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores — hubo que
hacer `sortInstallmentPurchases` genérica, perdía el campo
`paidInstallmentNumbers` del tipo extendido que usa
`InstallmentTracker` al tipar el retorno como el tipo base),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**51 archivos, 269 tests**, todos pasando).

## ✅ Fix: Un Mango Score y Recomendaciones no se actualizaban solos

Bug real reportado por el usuario (probado con una cuenta sin datos
cargados). Dos problemas distintos, ambos corregidos:

- [x] **No se refrescaban al cambiar datos en otro lado** — los dos
  widgets consultan sus datos una sola vez al montar
  (`useEffect(() => {...}, [])`). Los cambios hechos en Planes ya se
  reflejaban solos (esa pestaña se desmonta/remonta al cambiar de
  pestaña, así que vuelve a consultar), pero **Configuración es un
  overlay que no desmonta Inicio de atrás** — agregar o editar una
  billetera ahí no se reflejaba hasta refrescar la página entera. Se
  agregó un contador `dataVersion` en `page.tsx` que se bombea en
  `fetchWalletTotal()` (ya lo llama `fetchTransactions()` internamente,
  cubriendo Carga Manual y "Pagar" en los managers) y al cerrar
  Configuración — se lo pasa como `key` a ambos widgets, forzando que
  se remonten (y por lo tanto vuelvan a consultar) cuando cambia algo
  relevante.
- [x] **Con cero datos, mostraban números/alertas engañosos** — con
  todo en 0, la fórmula del Score daba 25/100 (no 0, por cómo se
  calcula el pilar de gasto hormiga cuando no hay ingreso), y
  Recomendaciones directamente mostraba **3 alertas de "peligro"**
  (ahorro, deuda y fondo de emergencia en 0) — exactamente lo que el
  usuario reportó como confuso. `hasNoFinancialData()` nueva en
  `financialHealthScore.ts` (pura, 3 tests): si no hay ingreso, gasto
  ni saldo en billeteras, ambos widgets ahora muestran un mensaje de
  onboarding ("cargá tu primer movimiento...") en vez de un número o
  alertas que no tienen sentido todavía.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**51 archivos, 272 tests**, todos pasando).

## ✅ Fix del fix: hasNoFinancialData todavía fallaba con billeteras con saldo

El usuario probó la tanda anterior y seguía viendo 25/100 y las 3
alertas de peligro. Causa: `hasNoFinancialData()` exigía que ingreso,
gasto Y saldo en billeteras fueran los tres 0 — pero el usuario tenía
saldo en billeteras de pruebas anteriores de la sesión (`Brubank`,
etc.), así que la condición nunca se cumplía aunque no hubiera ningún
movimiento cargado ESTE MES. Se sacó el saldo de billeteras de la
condición — ahora solo mira ingreso y gasto del mes (que es lo que
determina si los pilares de Ahorro/Deuda/Fondo de Emergencia tienen
sentido calculados o no, con o sin plata guardada de antes). 4 tests
actualizados/nuevos.

## ✅ 5 recomendaciones nuevas ("fáciles de sumar ya")

- [x] **Presupuesto excedido** — cruza el límite de cada categoría
  (`budgets`) con lo gastado ese mes (`get_monthly_category_spend`,
  misma función que ya usa `BudgetManager`). Menciona hasta 2 nombres y
  "y N más" si hay más. Acción → Planes, Presupuestos.
- [x] **Deuda con interés alto** — cualquier deuda "Yo debo" activa con
  `interest_rate > 0`. Acción → Planes, Deudas y Préstamos.
- [x] **Cuota grande** — la primera compra en cuotas cuya cuota mensual
  (`total_amount / installments_count`) supere el 20% del ingreso
  mensual. Si no hay ingreso registrado, no se evalúa (no hay
  "grande respecto a qué"). Acción → Planes, Cuotas.
- [x] **Racha de gasto rota** — `computeStreakBreak()` nueva en
  `zeroSpendStats.ts` (3 tests): si hoy hubo gasto y había una racha de
  3+ días sin gastos antes, mensaje motivacional (severidad `info`, sin
  acción — no hay nada que "hacer", solo ánimo).
- [x] **Meta de ahorro estancada** — `isGoalStalled()` nueva en
  `savingsGoalStall.ts` (4 tests): sigue en $0 después de 60+ días de
  creada. No hay una columna de "último aporte" en `savings_goals` (no
  se trackea historial de aportes) — se usa `created_at` como
  aproximación razonable. Acción → Planes, Metas de Ahorro.

Se agregaron los `id`s que faltaban (`presupuestos`, `deudas-prestamos`,
`cuotas`) a los contenedores de `BudgetManager`, `DebtsManager` e
`InstallmentTracker` para que las acciones nuevas tengan a dónde
hacer scroll. 7 tests nuevos sobre las 5 reglas (17 en total en
`financialAdvice.test.ts`).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**52 archivos, 287 tests**, todos pasando).

## ✅ Últimas 3 recomendaciones ("necesitan un poco más de trabajo")

Con esto se completó toda la lista sugerida en el brainstorm anterior.

- [x] **Sin categorías creadas** — si el usuario no tiene ninguna
  categoría, sugiere crear las sugeridas. Esta es la primera acción
  que **no** apunta a una pestaña, sino a **abrir Configuración**
  directamente (las categorías viven ahí) — `AdviceAction` se extendió
  con `openSettings?: boolean` y `tab` pasó a ser opcional;
  `handleAdviceNavigate` en `page.tsx` ahora entiende ambos casos.
- [x] **Sin ingreso registrado este mes** (aunque sí haya gastos) —
  avisa que el Score y el límite de gasto diario van a ser menos
  precisos hasta que se cargue. Acción → Inicio (donde vive el
  formulario de carga rápida).
- [x] **Balance de Hogar sin saldar hace tiempo** — si hay un hogar
  vinculado con gastos compartidos y el balance no está en $0, avisa
  cuando el gasto más viejo sin saldar lleva 30+ días. Reutiliza
  `computeHouseholdBalance()` ya existente. Como el `household_id`
  hace falta conocerlo antes de poder consultar sus gastos, esta es la
  única parte del widget que hace una consulta **secuencial** (primero
  busca el hogar activo, después sus gastos) en vez de ir toda junta en
  el `Promise.all` de arriba. Se agregó el `id="gastos-hogar"` que
  faltaba en `HouseholdExpenses.tsx`.

4 tests nuevos (21 en total en `financialAdvice.test.ts`).

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**52 archivos, 291 tests**, todos pasando).

Con esto, **Recomendaciones Financieras cubre las 13 reglas** de la
lista completa que se armó a partir de la pregunta original del
usuario ("¿hay alguna feature que me muestre mi situación financiera
con consejos...?").

## ✅ Fix: navegación de Recomendaciones — 2 bugs reales

El usuario probó la tanda 46 y reportó 3 síntomas, resultaron ser 2
causas:

- [x] **"Crear una Meta de Ahorro" / "Crear un Fondo de Emergencia"
  parecían llevar a Pagos Recurrentes** — el `id="metas-ahorro"` estaba
  bien puesto en el código, pero `SavingsGoals` (como todos los
  managers de Planes) carga sus datos de forma asíncrona y devuelve
  `null` mientras tanto — el `id` recién existe en el DOM una vez que
  termina. El scroll se disparaba con un `setTimeout` fijo de 50ms, que
  no siempre alcanzaba (depende de la latencia real de red); si no
  encontraba el elemento, no hacía nada, dejando la pantalla en la
  parte de arriba de Planes — donde está `RecurringManager` (Pagos
  Recurrentes), dando la falsa impresión de que "te llevaba ahí" cuando
  en realidad no se había movido. Se reemplazó por
  `scrollToElementWhenReady()`: reintenta cada 100ms hasta encontrar el
  elemento (hasta 3 segundos), en vez de un único intento a ciegas.
- [x] **"Cargar ingreso" no hacía nada** — el consejo vive en el
  widget de Inicio, y esa acción solo tenía `tab: 'inicio'` sin
  `sectionId` — cambiar a la pestaña en la que ya estás parado no
  produce ningún cambio visible en React (bail-out de estado
  idéntico), entonces literalmente no pasaba nada al tocarlo. Se le
  agregó `sectionId: 'transaction-form'` (id nuevo en el contenedor de
  `TransactionForm`), y de paso `handleManualEntry` (el mismo botón que
  usa el FAB) se migró al mismo mecanismo de reintento en vez de un
  `setTimeout` fijo.

Verificado en este sandbox: `npx tsc --noEmit` (0 errores),
`npx eslint .` (misma línea base pre-existente, nada nuevo),
`npx vitest run` (**52 archivos, 291 tests**, todos pasando).

## ✅ Mantenimiento de configuración y dependencias (tanda de infraestructura)

Ronda de higiene del proyecto, sin features nuevas: puesta al día de
dependencias, y tres archivos de configuración que faltaban.

### Dependencias actualizadas (parche/minor, sin majors)

Se actualizó todo lo que `npm outdated` marcaba como no-breaking:
- `@supabase/supabase-js` 2.110.9 → **2.111.0**
- `@supabase/ssr` 0.12.3 → **0.12.4** (sigue sin usarse — la decisión de
  implementar `proxy.ts` para auth server-side queda abierta como antes)
- `react` / `react-dom` 19.2.4 → **19.2.8** (estaban fijadas en versión
  exacta, se actualizaron con `npm install react@19.2.8 react-dom@19.2.8`)
- `lucide-react` 1.27.0 → **1.28.0**
- `@vitejs/plugin-react` 6.0.4 → **6.0.5**
- `jsdom` 30.0.0 → **30.0.1**
- `@playwright/test` 1.62.0 → **1.62.1**
- `@types/react` / `@types/react-dom` (patch)

**Se dejaron para evaluación aparte** (majors con breaking changes):
`eslint` 10, `typescript` 7 (rewrite en Go) y `@types/node` 26.

**Nota**: `npm audit` reporta 4 vulnerabilidades high, pero las 4 son
transitivas de `next` (postcss + sharp/libvips que next empaqueta).
`next` 16.2.12 es el último de la rama 16 — no hay patch que las
resuelva todavía; se siguen upstream.

### Configuración que faltaba

- [x] **`supabase/config.toml`** (nuevo) — no existía, y es requisito
  para `supabase start` (desarrollo local) y la forma declarativa de
  definir las Edge Functions. Incluye:
  - `project_id`, `[api]` (puerto 54321, `max_rows`).
  - `[auth]`: `site_url` + `additional_redirect_urls` para
    `http://localhost:3000` (necesario para el login social y el flujo
    de Google Calendar en local).
  - `[auth.external.google]` activo vía `env(GOOGLE_CLIENT_ID/SECRET)`
    (sin credenciales hardcodeadas); `azure`/`apple` quedaron
    comentados como plantilla.
  - `verify_jwt` por función, alineado con cómo se invoca cada una:
    `telegram-webhook` y `send-renewal-reminders` en `false` (las
    invoca Telegram/el cron, sin JWT), `sync-google-calendar` en
    `true` (la invoca el usuario logueado).
  - Los secrets NO van en este archivo — se setean con
    `supabase secrets set` (referencia en `.env.example`).
- [x] **`.env.example`** (nuevo) — plantilla de variables de entorno
  (URL/anon key de Supabase, OAuth para local) + bloque de referencia de
  los secrets de las 3 Edge Functions con los comandos exactos.
  **Ojo**: el `.gitignore` tiene `*.env*`, que lo ignoraba; se agregó
  la excepción `!.env.example` para que sí se commitee.
- [x] **Hardening de `src/lib/supabaseClient.ts`** — antes, si faltaban
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` la app
  caía silenciosamente en `placeholder.supabase.co` (riesgo de "funciona
  pero contra nada" en producción). Ahora lanza un error claro que indica
  qué falta y qué hacer (copiar `.env.example` a `.env.local`).
- [x] **`vitest.setup.ts`** — el hardening de arriba rompía 3 suites de
  tests que importan `supabaseClient` de forma transitiva sin mockearlo
  (`BackupRestore`, `ImportTransactions`, `SpeedDialFab`). Se setean
  env vars dummy de Supabase en el setup (los tests que usan Supabase lo
  mockean igual con `test-utils/supabaseMock`).

### Tests desincronizados que se aprovechó para corregir

Corriendo la suite completa aparecieron 2 tests que fallaban **desde
antes** de esta tanda (se verificó con `git stash` + corrida aislada:
fallaban igual con el código commiteado). La causa: `formatAmount` en
`PrivacyContext` formatea ARS con `maximumFractionDigits: 0` (ej.
`$ 4.500`, sin decimales), pero los tests esperaban `$ 4.500,00` y
`12.000,00` — quedaron desincronizados en una tanda anterior.
- `WalletManager.test.tsx`: `'$ 4.500,00'` → `'$ 4.500'`.
- `BudgetManager.test.tsx`: `'12.000,00'` → `'12.000'`.

(La intención del componente — pesos sin decimales — es la correcta para
finanzas personales en ARS; se corrigió la aserción, no el código.)

Verificado: `npx tsc --noEmit` (0 errores), `npm run build` (✅ sin
errores), `npx eslint .` (misma línea base pre-existente de siempre,
nada nuevo), `npx vitest run` (**53 archivos, 293 tests**, todos
pasando — antes había 2 fallando).

## ✅ Fase 1f — Sesión centralizada (UserContext) + corte de waterfalls de Hogar (item #5 de la auditoría)

El dashboard consumía la sesión de dos formas problemáticas:
**~20 componentes** llamaban `supabase.auth.getUser()` cada uno al
montar (una request de red duplicada por componente, con un estado de
"loading de sesión" propio en cada uno), y la carga de Hogar encadenaba
4 consultas secuenciales (getUser → buscar link → email del partner →
gastos), un waterfall que agregaba latencia de a una request por vez.

- [x] **`src/context/UserContext.tsx`** (`UserProvider` + `useUser()`):
  única fuente de la sesión. Expone `{ user, session, loading, refreshUser }`.
  Inicializa con `getSession()` y `getUser()` en **paralelo**
  (idempotente contra doble-invoke de StrictMode), y un listener de
  `supabase.auth.onAuthStateChange` mantiene `user`/`session`
  sincronizados ante login, logout y refresh de token — se eliminó el
  "cargar usuario por componente". `refreshUser()` re-pide ambas para
  el flujo de revalidación (ej. después de un OAuth). En `layout.tsx`
  queda por encima de todo lo que consume `useUser()`.
- [x] **`src/context/HouseholdContext.tsx`** (`HouseholdProvider` +
  `useHousehold()`): expone `{ link, householdId, partnerEmail, loading,
  refresh }`. Consulta el último `household_links` del usuario
  (`.or(user_a_id/user_b_id).limit(1).maybeSingle()`), solo expone
  `householdId` si el link está `active`, y trae el email del partner
  vía la RPC `get_household_partner_email` (security definer). Con esto
  el Hogar se consulta **una sola vez** y se comparte entre los
  componentes que lo usan.
- [x] **Waterfall roto**: `HouseholdExpenses` pasó de
  getUser→link→email→gastos a `useHousehold()` (link cacheado) +
  `useAsyncData()` para los gastos. `HouseholdLink` lee/regenera desde
  `useHousehold()` (`refresh()` tras cada operación). El balance de
  hogar de `FinancialAdviceWidget` ahora va **dentro del `Promise.all`**
  principal usando el `householdId` del contexto (se eliminó la consulta
  secuencial de la última tanda).
- [x] **Refactor masivo a `useUser()`**: los ~20 componentes que hacían
  su propio `getUser()` (BackupRestore, AntExpenses, CategoryManager,
  BudgetManager, DebtsManager, ExchangeGapSimulator, ImportTransactions,
  SubscriptionPriceAlerts, SavingsGoals, GoogleCalendarLink,
  InstallmentTracker, RecurringManager, QrInvoiceScanner,
  SplitExpenseTool, OfflineSyncManager, TelegramLink, VoiceExpenseInput,
  TransactionForm, WalletManager, WorkSettings) ahora leen `user` del
  contexto. `page.tsx` también (su `loading` es bootstrap de sesión +
  paginación manual; redirige a `/login` si no hay user).
- [x] **Fix de bug real de deps de efectos**: los effects que usan
  `user` del contexto corren ANTES de que la sesión se resuelva
  (`user=null` → return temprano → nunca recargan). Se corrigieron las
  deps (`[user]` o `useCallback` memoizado) en: `page.tsx`
  (`fetchTransactions`), `AntExpenses`, `BudgetManager`, `SavingsGoals`,
  `RecurringManager`, `SubscriptionPriceAlerts`, `DebtsManager`,
  `ExchangeGapSimulator`, `GoogleCalendarLink`, `InstallmentTracker`,
  `OfflineSyncManager`, `TelegramLink`, `TransactionForm`,
  `WorkSettings`. `GoogleCalendarLink` dividió su efecto (checkConnection
  con `[user]` + listener de OAuth una sola vez).
- [x] **Tests**: `src/context/__tests__/UserContext.test.tsx` (6 tests —
  expone user, inicializa sesión paralela una vez, logout, login, refresh,
  error) y `src/context/__tests__/HouseholdContext.test.tsx` (4 tests —
  link activo cacheado, sin link, loading inicial, se resetea al
  desloguear). Se amplió `supabaseMock` (`getSession`, `getUser`,
  `signOut`, `onAuthStateChange` + filtros `or`/`limit`/`maybeSingle`/
  `single`) y se creó `src/test-utils/AppProviders.tsx` (wrapper
  `UserProvider + HouseholdProvider`). Los tests de componentes que
  montan providers ahora usan `AppProviders`.
- [x] **Fix de mock**: `maybeSingle()`/`single()` del mock resuelven con
  objeto (o null) y no con array — `HouseholdLink` y otros dependen de
  eso.

Verificado: `npx tsc --noEmit` (0 errores), `npx vitest run`
(**57 archivos, 328 tests**, todos pasando — 318 previos + 10 nuevos),
`npx eslint .` (18 errores — los 17 `set-state-in-effect` + 1 `any` de
la línea base pre-existente, nada nuevo; los warnings de
`exhaustive-deps` que este refactor introdujo se corrigieron en la misma
tanda).

## ✅ Limpieza de deuda de ESLint — `react-hooks/set-state-in-effect` (línea base a 0)

`eslint-plugin-react-hooks@7.0.0` introdujo la regla del React Compiler
`react-hooks/set-state-in-effect`, que la app traía desde el upgrade de
dependencias (Fase de mantenimiento): **18 errores** (17
`set-state-in-effect` + 1 `no-explicit-any`) y **2 warnings** de imports
sin usar. Se llevó la línea base a **0 errores / 0 warnings**:

- [x] **Casos síncronos reales → lazy initializer / estado derivado**
  (la regla acierta, y el fix correcto es no setear en el effect):
  - `AntExpenses`: `threshold` ahora se lee de `localStorage` con
    `useState(() => …)` en vez de un effect que lo seteaba tras montar.
  - `VoiceExpenseInput`: `supported` (Web Speech API) se detecta con
    lazy initializer; se eliminó el effect que lo recalculaba (y su
    `setSupported` quedó sin uso).
  - `OfflineSyncManager`: `isOnline` y `pendingCount` se inicializan con
    lazy initializer; se eliminaron los `setState` redundantes del effect.
  - `TransactionFilters`: el filtrado ya **se deriva con `useMemo`** en el
    render en vez de guardarse en estado con un effect; la notificación
    al padre (`onFiltered`) vive en un effect separado.
  - `CategoriesContext` / `HouseholdContext`: `loading` ahora **se
    deriva** como `userLoading || dataLoading` en el render (el effect
    que hacía `setLoading(userLoading)` desapareció).
- [x] **Falsos positivos de loaders async → `eslint-disable-next-line`
  con justificación** (la regla no distingue el setState síncrono en el
  body del effect del que ocurre *después del `await`*, en un microtask,
  que no causa render en cascada). Se verificó empíricamente con un probe
  antes de aplicar el criterio: `.then(setData)` y IIFE async con setState
  post-await **no** se marcan; llamar a un loader externo (`load()` /
  `loadData()` / `refetch()`) **sí**, aunque sea idéntico. Aplicado en
  `useAsyncData` y los 10 componentes que cargan datos al montar
  (`ArsUsdCalculator`, `BudgetRule502030`, `DebtsManager`,
  `DollarRatesTable`, `ExchangeGapSimulator`, `GoogleCalendarLink`,
  `InstallmentTracker`, `SavingsGoals`, `TelegramLink`,
  `OfflineSyncManager`).
  - `ThemeContext` es el único caso **síncrono** silenciado: el patrón
    anti-flash/hidratación es intencional (localStorage es inaccesible
    en el SSR; el script inline de `layout.tsx` ya pintó la clase y el
    effect solo sincroniza el estado de React al montar).
- [x] **`no-explicit-any` + warnings**: el `as any` de `TransactionFilters`
  (filtro de tipo) se tipó como `'all' | 'income' | 'expense'`, y se
  removieron los imports `Filter` (TransactionFilters) y `Tag`
  (TransactionForm) que no se usaban.

Verificado: `npx tsc --noEmit` (0 errores), `npx eslint .`
(**0 errores, 0 warnings**), `npx vitest run` (**57 archivos, 328 tests**,
todos pasando), `npm run build` (OK).

## ✅ Safe-to-Spend (Gasto Seguro Diario) — Fase 2 UX/UI y valor de producto

Se rediseñó el widget "Podés gastar hoy" para que descuente **todo** lo
que ya está comprometido del mes y muestre un límite diario con semáforo
de estado, en vez del cálculo viejo que solo restaba gastos fijos.

- [x] **`src/lib/safeToSpend.ts`** (rediseñado, función pura):
  - `computeSafeToSpend(input)` recibe
    `{ totalBalance, monthlyFixedCommitments, budgetedAllocations,
    savingsContributions, installmentCommitments, monthlyIncome,
    daysRemaining }` y devuelve
    `{ availableBalance, daysRemaining, dailyLimit, status }`.
  - `availableBalance = totalBalance - (fijos + presupuestos + metas +
    cuotas del mes)`.
  - `dailyLimit = max(0, availableBalance / max(1, daysRemaining))` —
    nunca negativo (los fijos ya superan el balance ⇒ 0).
  - Semáforo: **Rojo** (`availableBalance ≤ 0`, sobregastado) ·
    **Amarillo** (`dailyLimit < (monthlyIncome/30) * 0.10`, ajustado —
    umbral en `tightStatusThreshold`) · **Verde** (seguro, el resto).
    Documentado que el amarillo usa `<` estricto: en el límite exacto
    sigue siendo verde.
  - `getDaysRemainingInMonth(today)`: días que quedan del mes **con
    hoy incluido** (`díasDelMes - díaActual + 1`), función pura testeada.
  - Nota de diseño: sumar los límites completos de presupuestos es
    **conservador** — si un recurrente comparte categoría con un
    presupuesto cuenta dos veces. Intencional (mejor subestimar que
    sobreestimar lo que se puede gastar).
- [x] **`src/context/DashboardDataContext.tsx`**: `DashboardData` suma 3
  campos — `budgetAllocation` (Σ `budgets.monthly_limit`),
  `savingsContribution` (Σ `savings_goals.monthly_contribution`) e
  `installmentCommitments` (Σ `total_amount / installments_count`, **se
  deriva del array `installments` que el contexto ya traía** — no se
  agrega una query redundante). En el `Promise.all` se suman 2 consultas
  ligeras (`budgets`, `savings_goals`) a las 5 existentes.
- [x] **`src/components/SafeToSpendWidget.tsx`** (rediseñado): consume
  `useDashboardData()` + `useWallets().totalBalance` (saldo real en
  billeteras, decisión del usuario) + `usePrivacy()` (formato/privacidad).
  Muestra el límite diario grande coloreado según el semáforo, badge
  "Seguro / Ajustado / Sobregastado" con icono, y un desglose con las 4
  deducciones (fijos, presupuestos, metas, cuotas) + "queda disponible".
- [x] **`src/components/FinancialAdviceWidget.tsx`**: el `safeToSpendToday`
  que alimenta las recomendaciones ahora usa la misma fórmula
  (balance real de billeteras − todos los compromisos, `.dailyLimit`); la
  query de `savings_goals` trae además `monthly_contribution`.
- [x] **Tests** (`src/lib/__tests__/safeToSpend.test.ts`, reescritos, 16):
  descuenta las 4 categorías, divide entre días (incluye hoy), clamp a 0,
  Verde/Amarillo/Rojo (incluido el límite exacto del umbral), `daysRemaining
  = 0` no divide por cero, y `getDaysRemainingInMonth` en 1ro/15/31 y
  febrero.

Verificado: `npx tsc --noEmit` (0 errores), `npx eslint .`
(**0 errores, 0 warnings**), `npx vitest run` (**57 archivos, 340 tests**,
todos pasando — 328 previos + 16 nuevos − 4 viejos reemplazados), `npm run
build` (OK).
