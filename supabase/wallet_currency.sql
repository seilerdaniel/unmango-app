-- =============================================================
-- UnMango — Billeteras multidivisa (moneda ARS/USD)
--
-- Correr después de todos los SQL anteriores (wallets.sql,
-- wallet_cards.sql, wallet_tna.sql, etc.).
--
-- Cada billetera puede denominarse en ARS (default) o USD. La moneda
-- es solo la etiqueta/denominación: el saldo se sigue llevando en
-- amount_ars (igual que el resto de la app) y se convierte al tipo de
-- cambio MEP/Blue seleccionado para mostrarse en USD
-- (src/lib/exchangeRates.ts y la réplica en
-- supabase/functions/telegram-webhook/reply-builder.ts).
-- =============================================================

alter table public.wallets
  add column if not exists currency varchar(3) not null default 'ARS';

alter table public.wallets drop constraint if exists wallets_currency_check;
alter table public.wallets
  add constraint wallets_currency_check
  check (currency in ('ARS', 'USD'));
