-- =============================================================
-- UnMango — Sincronización con Google Calendar
--
-- Correr después de todos los SQL anteriores.
--
-- google_calendar_tokens: guarda el refresh_token de Google de cada
-- usuario que conectó su cuenta (obtenido vía Supabase Auth con
-- signInWithOAuth y scope de Calendar). Con ese refresh_token, la Edge
-- Function de sincronización puede pedir un access_token nuevo cada
-- vez que necesita crear/actualizar eventos, sin que el usuario tenga
-- que volver a loguearse.
--
-- google_calendar_events: mapea cada suscripción/servicio/cuota con el
-- ID del evento que se creó en Google Calendar para ella — así, la
-- próxima sincronización ACTUALIZA ese evento en vez de duplicarlo.
-- =============================================================

create table if not exists public.google_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  refresh_token text not null,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

drop policy if exists "google_calendar_tokens_select_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_select_own"
  on public.google_calendar_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "google_calendar_tokens_insert_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_insert_own"
  on public.google_calendar_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "google_calendar_tokens_update_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_update_own"
  on public.google_calendar_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "google_calendar_tokens_delete_own" on public.google_calendar_tokens;
create policy "google_calendar_tokens_delete_own"
  on public.google_calendar_tokens for delete
  using (auth.uid() = user_id);

create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_table text not null check (source_table in ('recurring_expenses', 'installment_purchases', 'debts')),
  source_id uuid not null,
  google_event_id text not null,
  updated_at timestamptz not null default now(),
  unique (source_table, source_id)
);

alter table public.google_calendar_events enable row level security;

drop policy if exists "google_calendar_events_select_own" on public.google_calendar_events;
create policy "google_calendar_events_select_own"
  on public.google_calendar_events for select
  using (auth.uid() = user_id);

-- Insert/update/delete de esta tabla los hace la Edge Function con la
-- service role key (bypassa RLS a propósito) — no hace falta que el
-- usuario logueado escriba acá directamente.
