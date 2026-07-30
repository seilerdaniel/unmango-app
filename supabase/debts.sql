-- =============================================================
-- UnMango — Deudas y Préstamos
--
-- Correr después de todos los SQL anteriores.
--
-- Trackea plata que le debés a alguien ("debo") o que alguien te debe
-- a vos ("me_deben") — ej. "le presté $50.000 a mi hermano" o "le debo
-- $30.000 a Juan por el viaje". Cada pago/cobro parcial se registra en
-- debt_payments Y opcionalmente genera una transacción real (gasto si
-- es un pago que hacés, ingreso si es un cobro que recibís), igual que
-- ya hacen las suscripciones y las cuotas.
-- =============================================================

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  counterparty_name text not null,
  debt_type text not null check (debt_type in ('debo', 'me_deben')),
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  total_amount numeric not null check (total_amount > 0),
  remaining_amount numeric not null,
  interest_rate numeric not null default 0,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.debts enable row level security;

drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own" on public.debts for select using (auth.uid() = user_id);

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own" on public.debts for insert with check (auth.uid() = user_id);

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own" on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own" on public.debts for delete using (auth.uid() = user_id);

-- Historial de pagos/cobros parciales de cada deuda.
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  transaction_id uuid references public.transactions(id) on delete set null,
  paid_at timestamptz not null default now()
);

alter table public.debt_payments enable row level security;

drop policy if exists "debt_payments_select_own" on public.debt_payments;
create policy "debt_payments_select_own" on public.debt_payments for select using (auth.uid() = user_id);

drop policy if exists "debt_payments_insert_own" on public.debt_payments;
create policy "debt_payments_insert_own" on public.debt_payments for insert with check (auth.uid() = user_id);
