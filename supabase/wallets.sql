-- =============================================================
-- UnMango — Saldo por Billetera (Fase 5)
--
-- Cómo usar: correr esto en el SQL Editor de Supabase, después de
-- rls_policies.sql y functions.sql (Fases 1 y 3).
--
-- Qué agrega:
-- 1. Tabla `wallets`: las cuentas/billeteras del usuario (Mercado Pago,
--    efectivo, banco, etc.) con un saldo inicial.
-- 2. Columna `wallet_id` en `transactions` (nullable): cada movimiento
--    puede — opcionalmente — asociarse a una billetera. Las
--    transacciones viejas quedan sin asignar (wallet_id = null) y
--    simplemente no impactan el saldo de ninguna billetera; no hace
--    falta backfillear nada para que esto funcione.
-- 3. Política RLS para `wallets`, igual patrón que las demás tablas.
-- 4. Función `get_wallet_balances()`: saldo actual de cada billetera
--    (saldo inicial + ingresos - gastos de sus transacciones),
--    calculado en Postgres.
--
-- Nota de alcance: por ahora las billeteras se llevan en ARS (se usa
-- amount_ars igual que el resto del dashboard). Si más adelante querés
-- una billetera 100% en USD, se puede sumar con una columna adicional;
-- no lo armé ahora para no sobrediseñar algo que no pediste.
-- =============================================================

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other' check (type in ('cash', 'bank', 'virtual_wallet', 'other')),
  color text,
  initial_balance numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
  on public.wallets for select
  using (auth.uid() = user_id);

drop policy if exists "wallets_insert_own" on public.wallets;
create policy "wallets_insert_own"
  on public.wallets for insert
  with check (auth.uid() = user_id);

drop policy if exists "wallets_update_own" on public.wallets;
create policy "wallets_update_own"
  on public.wallets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "wallets_delete_own" on public.wallets;
create policy "wallets_delete_own"
  on public.wallets for delete
  using (auth.uid() = user_id);

-- Columna nueva en transactions. IF NOT EXISTS la hace segura de correr
-- más de una vez.
alter table public.transactions
  add column if not exists wallet_id uuid references public.wallets(id) on delete set null;

-- Saldo de cada billetera del usuario actual: saldo inicial +/- sus
-- transacciones asociadas. Un LEFT JOIN asegura que una billetera recién
-- creada (sin movimientos todavía) también aparezca, mostrando solo su
-- saldo inicial.
create or replace function public.get_wallet_balances()
returns table (wallet_id uuid, balance numeric)
language sql
security invoker
set search_path = public
as $$
  select
    w.id as wallet_id,
    w.initial_balance
      + coalesce(sum(case when t.type = 'income' then t.amount_ars else 0 end), 0)
      - coalesce(sum(case when t.type = 'expense' then t.amount_ars else 0 end), 0)
      as balance
  from public.wallets w
  left join public.transactions t
    on t.wallet_id = w.id and t.user_id = auth.uid()
  where w.user_id = auth.uid()
  group by w.id, w.initial_balance;
$$;
