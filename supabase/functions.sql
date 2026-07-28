-- =============================================================
-- UnMango — Funciones de agregación (RPC)
-- Fase 3 de la auditoría (ver AUDIT.md)
--
-- Por qué existe este archivo: antes, el balance total y el gasto
-- mensual por categoría se calculaban en el frontend sumando el
-- array completo de transacciones. Eso obliga a traer TODA la
-- historia de movimientos del usuario en cada carga de página, algo
-- que con el tiempo se vuelve lento y pesado.
--
-- Estas funciones calculan las sumas del lado de Postgres (mucho más
-- rápido) y devuelven solo el resultado agregado, no las filas. La
-- lista de movimientos en pantalla se puede paginar por separado sin
-- afectar la exactitud del balance ni de los presupuestos.
--
-- Cómo usar: pegar y correr esto en el SQL Editor de Supabase,
-- después de haber corrido rls_policies.sql.
-- =============================================================

-- Totales de ingresos/gastos de TODA la historia del usuario actual.
create or replace function public.get_transaction_totals()
returns table (total_income numeric, total_expense numeric)
language sql
security invoker
set search_path = public
as $$
  select
    coalesce(sum(amount_ars) filter (where type = 'income'), 0) as total_income,
    coalesce(sum(amount_ars) filter (where type = 'expense'), 0) as total_expense
  from public.transactions
  where user_id = auth.uid();
$$;

-- Gasto acumulado por categoría durante un mes/año puntual, para el
-- usuario actual. Se usa en BudgetManager para calcular el % consumido
-- de cada presupuesto sin depender de tener todas las transacciones
-- cargadas en el frontend.
create or replace function public.get_monthly_category_spend(p_year int, p_month int)
returns table (category_id uuid, spent numeric)
language sql
security invoker
set search_path = public
as $$
  select
    category_id,
    sum(amount_ars) as spent
  from public.transactions
  where user_id = auth.uid()
    and type = 'expense'
    and category_id is not null
    and extract(year from created_at) = p_year
    and extract(month from created_at) = p_month
  group by category_id;
$$;

-- Ambas funciones son "security invoker" (el default en Postgres, lo
-- dejamos explícito): corren con los mismos permisos del usuario que
-- las llama, así que las políticas RLS de la tabla transactions se
-- siguen aplicando exactamente igual que si el frontend hiciera el
-- select directo. No son un bypass de RLS.

-- =============================================================
-- Verificación rápida (reemplazá con tu propio user autenticado
-- desde el SQL Editor no vas a poder probar auth.uid() directamente;
-- probalas desde la app o con supabase.rpc(...) desde el frontend).
-- =============================================================
