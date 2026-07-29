-- =============================================================
-- UnMango — Snapshots de patrimonio (idea #11: brecha cambiaria)
--
-- Correr después de todos los SQL anteriores.
--
-- La idea original: "un gráfico simple que muestre cómo varió tu
-- patrimonio en pesos vs. su equivalente en USD Blue en los últimos 3
-- o 6 meses". Para eso hace falta ir guardando, día a día, tu
-- patrimonio en pesos junto con la cotización del Blue de ESE día — no
-- existía nada de esto antes, así que el gráfico va a arrancar vacío y
-- crecer a partir de que corras esto (no hay forma de reconstruir
-- cotizaciones pasadas de manera confiable con lo que ya tenías
-- cargado).
-- =============================================================

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null default current_date,
  total_balance_ars numeric not null,
  usd_blue_rate numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

alter table public.net_worth_snapshots enable row level security;

drop policy if exists "net_worth_snapshots_select_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_select_own"
  on public.net_worth_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "net_worth_snapshots_insert_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_insert_own"
  on public.net_worth_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "net_worth_snapshots_update_own" on public.net_worth_snapshots;
create policy "net_worth_snapshots_update_own"
  on public.net_worth_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
