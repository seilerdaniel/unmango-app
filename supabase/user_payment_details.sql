-- =============================================================
-- UnMango — Datos de cobro para el WhatsApp Splitter
--
-- Correr después de todos los SQL anteriores.
--
-- Guarda los datos de transferencia del usuario (alias bancario, CBU o
-- link de Mercado Pago) que se incluyen automáticamente en las tarjetas
-- de cobro por WhatsApp generadas al dividir un gasto o liquidar el
-- Modo Hogar. Es un registro 1:1 con el usuario, como user_work_settings.
-- =============================================================

create table if not exists public.user_payment_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payment_details text,
  updated_at timestamptz not null default now()
);

alter table public.user_payment_details enable row level security;

drop policy if exists "user_payment_details_select_own" on public.user_payment_details;
create policy "user_payment_details_select_own"
  on public.user_payment_details for select
  using (auth.uid() = user_id);

drop policy if exists "user_payment_details_insert_own" on public.user_payment_details;
create policy "user_payment_details_insert_own"
  on public.user_payment_details for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_payment_details_update_own" on public.user_payment_details;
create policy "user_payment_details_update_own"
  on public.user_payment_details for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
