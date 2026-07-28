-- =============================================================
-- UnMango — Gastos en cuotas (idea #14)
--
-- Correr después de los SQL anteriores.
--
-- Registra una compra en N cuotas fijas. En vez de crear N transacciones
-- "futuras" reales al momento de cargar la compra (lo que ensuciaría el
-- historial con gastos que todavía no pasaron), esta tabla guarda el
-- plan de cuotas, y una función devuelve cuáles vencen en el mes
-- consultado — la cuota se convierte en una transacción real recién
-- cuando efectivamente se paga (con el mismo botón "Pagar" que ya usan
-- las suscripciones).
-- =============================================================

create table if not exists public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  total_amount numeric not null check (total_amount > 0),
  installments_count int not null check (installments_count > 0),
  first_installment_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.installment_purchases enable row level security;

drop policy if exists "installments_select_own" on public.installment_purchases;
create policy "installments_select_own"
  on public.installment_purchases for select
  using (auth.uid() = user_id);

drop policy if exists "installments_insert_own" on public.installment_purchases;
create policy "installments_insert_own"
  on public.installment_purchases for insert
  with check (auth.uid() = user_id);

drop policy if exists "installments_delete_own" on public.installment_purchases;
create policy "installments_delete_own"
  on public.installment_purchases for delete
  using (auth.uid() = user_id);

-- Qué cuotas ya se marcaron como pagadas (para no duplicar el pago ni
-- perder el registro si se borra la transacción por error).
create table if not exists public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  installment_purchase_id uuid not null references public.installment_purchases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  installment_number int not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  paid_at timestamptz not null default now(),
  unique (installment_purchase_id, installment_number)
);

alter table public.installment_payments enable row level security;

drop policy if exists "installment_payments_select_own" on public.installment_payments;
create policy "installment_payments_select_own"
  on public.installment_payments for select
  using (auth.uid() = user_id);

drop policy if exists "installment_payments_insert_own" on public.installment_payments;
create policy "installment_payments_insert_own"
  on public.installment_payments for insert
  with check (auth.uid() = user_id);
