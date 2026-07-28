-- =============================================================
-- UnMango — Metas de Ahorro (Fase 5)
--
-- Correr después de rls_policies.sql, functions.sql y wallets.sql.
--
-- La proyección (cuántos meses faltan para llegar a la meta, con interés
-- compuesto opcional) se calcula en el frontend con la lógica de valor
-- futuro de anualidad — no hace falta una función de Postgres para esto,
-- es aritmética simple sobre los datos de una fila.
-- =============================================================

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric not null default 0,
  monthly_contribution numeric not null default 0,
  -- Tasa de interés mensual como decimal (0.01 = 1% mensual). Si no
  -- aplica (ahorro "bajo el colchón"), se deja en 0.
  monthly_interest_rate numeric not null default 0,
  color text,
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists "savings_goals_select_own" on public.savings_goals;
create policy "savings_goals_select_own"
  on public.savings_goals for select
  using (auth.uid() = user_id);

drop policy if exists "savings_goals_insert_own" on public.savings_goals;
create policy "savings_goals_insert_own"
  on public.savings_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "savings_goals_update_own" on public.savings_goals;
create policy "savings_goals_update_own"
  on public.savings_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "savings_goals_delete_own" on public.savings_goals;
create policy "savings_goals_delete_own"
  on public.savings_goals for delete
  using (auth.uid() = user_id);
