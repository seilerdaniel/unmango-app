-- =============================================================
-- UnMango — Modo Hogar / Pareja
--
-- Correr después de todos los SQL anteriores.
--
-- Permite vincular dos cuentas de UnMango para llevar los gastos
-- comunes de la casa (alquiler, expensas, supermercado, hijos) sin
-- mezclarlos con los gastos personales de cada uno. Al final del mes,
-- calcula quién puso más plata para la casa y cuánto le debe el otro
-- para quedar a mano.
--
-- Flujo de vinculación (parecido al de Telegram):
-- 1. Usuario A genera un código de invitación (household_links con
--    user_b_id en null, status='pending').
-- 2. Usuario A le pasa el código a Usuario B (por el medio que sea).
-- 3. Usuario B lo carga en su propia app -> accept_household_invite().
-- =============================================================

create table if not exists public.household_links (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid references auth.users(id) on delete cascade,
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  check (user_a_id <> user_b_id)
);

alter table public.household_links enable row level security;

drop policy if exists "household_links_select_own" on public.household_links;
create policy "household_links_select_own"
  on public.household_links for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

drop policy if exists "household_links_insert_own" on public.household_links;
create policy "household_links_insert_own"
  on public.household_links for insert
  with check (auth.uid() = user_a_id);

drop policy if exists "household_links_delete_own" on public.household_links;
create policy "household_links_delete_own"
  on public.household_links for delete
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- No hay policy de UPDATE genérica a propósito — aceptar una
-- invitación (poner user_b_id) se hace SOLO a través de la función de
-- abajo (security definer), nunca con un UPDATE directo del cliente.
-- Así evitamos tener que escribir una policy de UPDATE que intente
-- restringir "solo se puede completar user_b_id, nada más" columna por
-- columna, que es más frágil que simplemente no exponer esa operación
-- como UPDATE libre.

create or replace function public.accept_household_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_user_a_id uuid;
begin
  select id, user_a_id into v_household_id, v_user_a_id
  from public.household_links
  where invite_code = p_invite_code and status = 'pending' and user_b_id is null;

  if v_household_id is null then
    raise exception 'Código inválido o ya usado';
  end if;

  if v_user_a_id = auth.uid() then
    raise exception 'No podés vincularte con vos mismo';
  end if;

  update public.household_links
  set user_b_id = auth.uid(), status = 'active', linked_at = now()
  where id = v_household_id;

  return v_household_id;
end;
$$;

-- Devuelve el email de la otra persona del hogar — hace falta una
-- función con privilegios elevados porque un usuario común no puede
-- leer auth.users de nadie más directamente.
create or replace function public.get_household_partner_email(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_email text;
begin
  select case when user_a_id = auth.uid() then user_b_id else user_a_id end
  into v_partner_id
  from public.household_links
  where id = p_household_id and (user_a_id = auth.uid() or user_b_id = auth.uid());

  if v_partner_id is null then
    return null;
  end if;

  select email into v_email from auth.users where id = v_partner_id;
  return v_email;
end;
$$;

-- Gastos compartidos del hogar.
create table if not exists public.household_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household_links(id) on delete cascade,
  paid_by_user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.household_expenses enable row level security;

drop policy if exists "household_expenses_select_members" on public.household_expenses;
create policy "household_expenses_select_members"
  on public.household_expenses for select
  using (
    exists (
      select 1 from public.household_links hl
      where hl.id = household_expenses.household_id
        and (hl.user_a_id = auth.uid() or hl.user_b_id = auth.uid())
    )
  );

drop policy if exists "household_expenses_insert_members" on public.household_expenses;
create policy "household_expenses_insert_members"
  on public.household_expenses for insert
  with check (
    paid_by_user_id = auth.uid()
    and exists (
      select 1 from public.household_links hl
      where hl.id = household_expenses.household_id
        and (hl.user_a_id = auth.uid() or hl.user_b_id = auth.uid())
    )
  );

drop policy if exists "household_expenses_delete_members" on public.household_expenses;
create policy "household_expenses_delete_members"
  on public.household_expenses for delete
  using (
    exists (
      select 1 from public.household_links hl
      where hl.id = household_expenses.household_id
        and (hl.user_a_id = auth.uid() or hl.user_b_id = auth.uid())
    )
  );
