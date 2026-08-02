-- =============================================================
-- UnMango — Rendimiento de billeteras (TNA)
--
-- Correr después de todos los SQL anteriores (wallets.sql,
-- wallet_cards.sql, etc.).
--
-- Las billeteras pueden rendir: billeteras virtuales con cuenta
-- remunerada (Mercado Pago, Ualá...), FCI o plazos fijos cargados
-- como "banco", etc. La TNA (tasa nominal anual, en %) cargada por
-- billetera permite estimar el rendimiento diario y mensual en la
-- app y en el bot de Telegram (src/lib/walletYield.ts y la réplica
-- en supabase/functions/telegram-webhook/reply-builder.ts).
-- =============================================================

alter table public.wallets
  add column if not exists tna_percentage numeric default 0;
