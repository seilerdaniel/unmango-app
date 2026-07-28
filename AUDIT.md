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

## 🔴 Fase 1 — Seguridad (antes de sumar usuarios reales)

- [ ] Verificar/crear políticas de **Row Level Security** en Supabase para
  las 4 tablas (`categories`, `transactions`, `budgets`, `recurring_expenses`),
  con `auth.uid() = user_id` en SELECT/INSERT/UPDATE/DELETE. Ninguna query del
  frontend filtra por usuario — toda la seguridad depende de esto.
- [ ] Confirmar que `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` estén seteadas en
  Vercel (producción) y no cayendo en el fallback `placeholder.supabase.co`.

## 🟠 Fase 2 — Bugs menores y UX

- [ ] `TransactionFilters.exportToCSV()` exporta siempre todas las
  transacciones en vez de las filtradas (`filteredTransactions`).
- [ ] Reemplazar `alert()`/`confirm()` nativos por un componente de
  toast/modal propio, consistente con el resto del diseño.
- [ ] Revisar otros `console.error` sin feedback visible al usuario
  (`BudgetManager`, `CategoryManager`).

## 🟡 Fase 3 — Deuda técnica

- [ ] Generar tipos de Supabase (`supabase gen types typescript`) y tipar el
  cliente (`createClient<Database>`) para que TypeScript detecte a futuro
  errores como el de la Fase 0 en tiempo de compilación.
- [ ] Extraer un hook/contexto `useCategories()` compartido — hoy se
  fetchean categorías por separado en 5 componentes distintos con código
  casi idéntico.
- [ ] Agregar paginación o límite a la consulta de transacciones
  (`page.tsx` trae el historial completo sin límite).
- [ ] Evaluar si conviene implementar `middleware.ts` + `@supabase/ssr`
  (ya está como dependencia pero no se usa en ningún lado) para proteger
  rutas del lado del servidor, o sacar la dependencia si se decide seguir
  100% client-side.

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
