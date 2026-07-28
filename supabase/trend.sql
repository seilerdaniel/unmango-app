-- =============================================================
-- UnMango — Tendencia mensual de ingresos/gastos (Fase 5)
--
-- Correr después de rls_policies.sql, functions.sql, wallets.sql y
-- savings_goals.sql.
-- =============================================================

create or replace function public.get_monthly_trend(p_months int default 6)
returns table (month_start date, total_income numeric, total_expense numeric)
language sql
security invoker
set search_path = public
as $$
  select
    date_trunc('month', t.created_at)::date as month_start,
    coalesce(sum(t.amount_ars) filter (where t.type = 'income'), 0) as total_income,
    coalesce(sum(t.amount_ars) filter (where t.type = 'expense'), 0) as total_expense
  from public.transactions t
  where t.user_id = auth.uid()
    and t.created_at >= date_trunc('month', now()) - ((p_months - 1) || ' months')::interval
  group by 1
  order by 1;
$$;
