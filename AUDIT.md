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

---
_Generado en sesión de auditoría con Claude — 28/07/2026._
