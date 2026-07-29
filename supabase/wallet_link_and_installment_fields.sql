-- =============================================================
-- UnMango — Billetera vinculada a suscripciones + campos extra en cuotas
--
-- Correr después de todos los SQL anteriores (incluido wallet_cards.sql).
-- =============================================================

-- Para que al elegir "Billetera Virtual", "Banco" o una tarjeta como
-- medio de pago de una suscripción, se pueda elegir CUÁL billetera/
-- cuenta/tarjeta puntual (de las que ya creaste en Mis Billeteras).
alter table public.recurring_expenses
  add column if not exists wallet_id uuid references public.wallets(id) on delete set null;

-- Método de pago y notas libres en compras en cuotas (ej. "es una
-- devolución a mi hermano", "cuotas sin interés").
alter table public.installment_purchases
  add column if not exists payment_method text,
  add column if not exists notes text;
