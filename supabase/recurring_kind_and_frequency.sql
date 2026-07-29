-- =============================================================
-- UnMango — Tipo de gasto recurrente + frecuencia de facturación
--
-- Correr después de todos los SQL anteriores.
--
-- expense_kind separa "Suscripciones" (Netflix, Spotify, etc.) de
-- "Servicios y Alquiler" (luz, gas, alquiler) en dos secciones
-- distintas de la app, aunque comparten la misma tabla — es la misma
-- mecánica (vencimiento, billetera vinculada, pago, edición), lo único
-- que cambia es cómo se agrupan visualmente.
--
-- billing_frequency indica si la suscripción/servicio se factura todos
-- los meses o una vez al año (ej. un dominio, un seguro anual).
-- =============================================================

alter table public.recurring_expenses
  add column if not exists expense_kind text not null default 'subscription'
    check (expense_kind in ('subscription', 'utility_rent')),
  add column if not exists billing_frequency text not null default 'monthly'
    check (billing_frequency in ('monthly', 'annual')),
  add column if not exists billing_month int check (billing_month between 1 and 12);

comment on column public.recurring_expenses.billing_month is
  'Solo se usa cuando billing_frequency = annual: en qué mes del año se factura (1-12). Para las mensuales queda en null.';
