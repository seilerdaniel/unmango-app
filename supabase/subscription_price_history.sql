-- =============================================================
-- UnMango — Historial de precios de suscripciones (idea #3)
--
-- Correr después de los SQL anteriores.
--
-- Para poder avisar "che, Netflix subió de precio" hace falta saber
-- cuánto costaba ANTES — hoy no se guarda nada de eso. Esta tabla
-- registra un snapshot del monto cada vez que se crea o actualiza una
-- suscripción, y una función que la compara contra el registro anterior.
-- =============================================================

create table if not exists public.recurring_expense_price_history (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references public.recurring_expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null,
  currency text not null,
  recorded_at timestamptz not null default now()
);

alter table public.recurring_expense_price_history enable row level security;

drop policy if exists "price_history_select_own" on public.recurring_expense_price_history;
create policy "price_history_select_own"
  on public.recurring_expense_price_history for select
  using (auth.uid() = user_id);

drop policy if exists "price_history_insert_own" on public.recurring_expense_price_history;
create policy "price_history_insert_own"
  on public.recurring_expense_price_history for insert
  with check (auth.uid() = user_id);

-- Cada vez que se inserta o se actualiza el monto/moneda de una
-- suscripción, guardamos un snapshot automáticamente — así el usuario
-- no tiene que acordarse de hacer nada para que esto funcione.
create or replace function public.record_recurring_expense_price()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') or (new.amount is distinct from old.amount) or (new.currency is distinct from old.currency) then
    insert into public.recurring_expense_price_history (recurring_expense_id, user_id, amount, currency)
    values (new.id, new.user_id, new.amount, new.currency);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_record_recurring_expense_price on public.recurring_expenses;
create trigger trg_record_recurring_expense_price
  after insert or update on public.recurring_expenses
  for each row
  execute function public.record_recurring_expense_price();

-- Devuelve, para cada suscripción activa, el precio anterior al actual
-- (si hay más de un registro en el historial) para poder comparar y
-- detectar aumentos.
create or replace function public.get_recurring_price_changes()
returns table (
  recurring_expense_id uuid,
  current_amount numeric,
  previous_amount numeric,
  currency text
)
language sql
security invoker
set search_path = public
as $$
  with ranked as (
    select
      recurring_expense_id,
      amount,
      currency,
      row_number() over (partition by recurring_expense_id order by recorded_at desc) as rn
    from public.recurring_expense_price_history
    where user_id = auth.uid()
  )
  select
    curr.recurring_expense_id,
    curr.amount as current_amount,
    prev.amount as previous_amount,
    curr.currency
  from ranked curr
  left join ranked prev
    on prev.recurring_expense_id = curr.recurring_expense_id and prev.rn = 2
  where curr.rn = 1;
$$;
