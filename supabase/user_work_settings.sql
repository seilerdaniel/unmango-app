-- =============================================================
-- UnMango — Configuración de ingreso/horas para "Costo en Horas de Trabajo"
--
-- Correr después de todos los SQL anteriores.
--
-- Guarda el ingreso mensual y las horas trabajadas por mes que el
-- usuario carga una sola vez en Configuración, para poder calcular su
-- "valor hora" y traducir cualquier gasto a "esto te cuesta X horas de
-- tu vida".
-- =============================================================

create table if not exists public.user_work_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric not null check (monthly_income > 0),
  monthly_work_hours numeric not null default 160 check (monthly_work_hours > 0),
  updated_at timestamptz not null default now()
);

alter table public.user_work_settings enable row level security;

drop policy if exists "user_work_settings_select_own" on public.user_work_settings;
create policy "user_work_settings_select_own"
  on public.user_work_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_work_settings_upsert_own" on public.user_work_settings;
create policy "user_work_settings_upsert_own"
  on public.user_work_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_work_settings_update_own" on public.user_work_settings;
create policy "user_work_settings_update_own"
  on public.user_work_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
