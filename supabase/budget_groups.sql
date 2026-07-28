-- =============================================================
-- UnMango — Regla 50/30/20 (idea #20 del documento de 20 ideas)
--
-- Correr después de los SQL anteriores (rls_policies, functions,
-- wallets, savings_goals, trend).
--
-- Agrega una columna a categories para poder clasificar cada categoría
-- en necesidad / deseo / ahorro. Es nullable: las categorías existentes
-- quedan sin clasificar hasta que el usuario las asigne desde la app
-- (no hace falta backfillear nada para que el resto de la app siga
-- funcionando).
-- =============================================================

alter table public.categories
  add column if not exists budget_group text
  check (budget_group in ('necesidad', 'deseo', 'ahorro') or budget_group is null);
