-- =============================================================
-- UnMango — Tarjetas de débito/crédito como billeteras
--
-- Correr después de todos los SQL anteriores.
--
-- Antes "wallets" solo tenía tipo cash/bank/virtual_wallet/other. Se
-- agregan 'credit_card' y 'debit_card', más una columna para la marca
-- (Visa, Mastercard, etc.) — así cada tarjeta que tengas es su propia
-- fila, con su propio nombre (ej. "Visa Banco Galicia",
-- "Mastercard Naranja"), y podés tener todas las que quieras.
-- =============================================================

alter table public.wallets drop constraint if exists wallets_type_check;
alter table public.wallets
  add constraint wallets_type_check
  check (type in ('cash', 'bank', 'virtual_wallet', 'credit_card', 'debit_card', 'other'));

alter table public.wallets
  add column if not exists card_network text;
