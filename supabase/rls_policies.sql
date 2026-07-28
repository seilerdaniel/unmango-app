-- =============================================================
-- UnMango — Políticas de Row Level Security
-- Fase 1 de la auditoría (ver AUDIT.md)
--
-- Cómo usar: pegar y correr esto en Supabase Dashboard
-- > SQL Editor > New query. Es idempotente: se puede correr
-- varias veces sin romper nada (usa DROP POLICY IF EXISTS antes
-- de crear cada una).
--
-- Por qué importa: el frontend NO filtra por user_id en varias
-- consultas (confía en RLS). Si alguna de estas policies falta o
-- está mal configurada, un usuario podría ver/editar/borrar datos
-- de otro usuario.
-- =============================================================

-- ---------- categories ----------
alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ---------- transactions ----------
alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ---------- budgets ----------
alter table public.budgets enable row level security;

drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- ---------- recurring_expenses ----------
alter table public.recurring_expenses enable row level security;

drop policy if exists "recurring_expenses_select_own" on public.recurring_expenses;
create policy "recurring_expenses_select_own"
  on public.recurring_expenses for select
  using (auth.uid() = user_id);

drop policy if exists "recurring_expenses_insert_own" on public.recurring_expenses;
create policy "recurring_expenses_insert_own"
  on public.recurring_expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_update_own" on public.recurring_expenses;
create policy "recurring_expenses_update_own"
  on public.recurring_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recurring_expenses_delete_own" on public.recurring_expenses;
create policy "recurring_expenses_delete_own"
  on public.recurring_expenses for delete
  using (auth.uid() = user_id);

-- =============================================================
-- Verificación rápida: correr esto después para confirmar que
-- las 4 tablas quedaron con RLS habilitado.
-- =============================================================
-- select tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('categories','transactions','budgets','recurring_expenses');
