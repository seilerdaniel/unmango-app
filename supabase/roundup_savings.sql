-- =============================================================
-- UnMango — Preferencias del "Bolsillo de Cambio" (Ahorro por Redondeo)
--
-- Correr después de todos los SQL anteriores.
--
-- Guarda por usuario si el ahorro por redondeo está activo y con qué
-- paso se redondea cada gasto ($100 / $500 / $1000). Si no existe una
-- fila, los valores por defecto (activado, paso $1.000) aplican.
--
-- Mismo patrón que user_work_settings.sql: una fila por usuario (user_id
-- como primary key) con RLS para que cada quien solo lea/edite la suya.
-- =============================================================

create table if not exists public.roundup_savings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roundup_enabled boolean not null default true,
  roundup_step numeric not null default 1000 check (roundup_step > 0),
  updated_at timestamptz not null default now()
);

alter table public.roundup_savings enable row level security;

drop policy if exists "roundup_savings_select_own" on public.roundup_savings;
create policy "roundup_savings_select_own"
  on public.roundup_savings for select
  using (auth.uid() = user_id);

drop policy if exists "roundup_savings_upsert_own" on public.roundup_savings;
create policy "roundup_savings_upsert_own"
  on public.roundup_savings for insert
  with check (auth.uid() = user_id);

drop policy if exists "roundup_savings_update_own" on public.roundup_savings;
create policy "roundup_savings_update_own"
  on public.roundup_savings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
