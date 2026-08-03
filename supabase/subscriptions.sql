-- =============================================================
-- UnMango — Suscripciones & Paywall PRO (Tanda 11d)
--
-- Correr después de todos los SQL anteriores.
--
-- Una fila por usuario (user_id unique): su plan y el estado de la
-- suscripción. Si un usuario no tiene fila acá, se asume plan 'free'
-- (getUserPlan en src/lib/subscription.ts).
-- =============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan varchar(20) not null default 'free' check (plan in ('free', 'pro', 'hogar')),
  status varchar(20) not null default 'active' check (status in ('active', 'trialing', 'canceled', 'past_due')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
