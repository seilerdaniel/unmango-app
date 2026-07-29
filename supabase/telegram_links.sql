-- =============================================================
-- UnMango — Vinculación con Telegram (idea #18)
--
-- Correr después de todos los SQL anteriores.
--
-- Cómo funciona la vinculación: el usuario genera un código de 6
-- dígitos desde la app (botón "Vincular Telegram"), le manda ese código
-- al bot de Telegram, y la Edge Function (webhook) busca el código acá
-- y completa telegram_chat_id. A partir de ahí, cualquier mensaje que
-- mande ese chat_id ya sabe a qué usuario de UnMango pertenece.
-- =============================================================

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linking_code text not null,
  telegram_chat_id bigint,
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  unique (user_id),
  unique (telegram_chat_id)
);

alter table public.telegram_links enable row level security;

drop policy if exists "telegram_links_select_own" on public.telegram_links;
create policy "telegram_links_select_own"
  on public.telegram_links for select
  using (auth.uid() = user_id);

drop policy if exists "telegram_links_insert_own" on public.telegram_links;
create policy "telegram_links_insert_own"
  on public.telegram_links for insert
  with check (auth.uid() = user_id);

drop policy if exists "telegram_links_update_own" on public.telegram_links;
create policy "telegram_links_update_own"
  on public.telegram_links for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "telegram_links_delete_own" on public.telegram_links;
create policy "telegram_links_delete_own"
  on public.telegram_links for delete
  using (auth.uid() = user_id);

-- Nota: la Edge Function usa la service role key (no esta política) para
-- poder buscar el linking_code de CUALQUIER usuario cuando llega el
-- mensaje de Telegram con el código — en ese momento no hay una sesión
-- de usuario logueado, es un webhook. Igual queda documentado acá para
-- que la app (con la sesión del usuario) también pueda leer/crear su
-- propio código.
