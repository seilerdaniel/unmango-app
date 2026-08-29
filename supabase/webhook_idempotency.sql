-- =============================================================
-- UnMango — Ledger de idempotencia de webhooks de pago
--
-- Correr después de subscriptions.sql (no dependen entre sí, pero
-- conviene mantener el orden).
--
-- Mercado Pago y Stripe reintentan el envío de una notificación/evento
-- hasta que el endpoint responde 200. Para que un reintento de red NO
-- duplique una renovación (el caso de mercadopago-webhook, que recalcula
-- current_period_end = ahora + 30d) ni reprocese trabajo, registramos el
-- identificador único de cada evento ya procesado en esta tabla.
--
--   - Stripe:  event_id = event.id (estable y persistente en reintentos).
--   - Mercado: event_id = "<type>:<resourceId>" (identifica la cuota /
--     pago / preapproval que disparó la notificación).
--
-- Solo la escriben las Edge Functions con la service role key (no hay RLS
-- de autenticación de usuario porque el service role bypasa RLS igual).
-- =============================================================

create table if not exists public.webhook_events (
  provider varchar(20) not null check (provider in ('mercadopago', 'stripe')),
  event_id text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.webhook_events enable row level security;

-- Nadie lee ni escribe directamente esta tabla desde el cliente; el único
-- acceso legítimo es la service role (bypasa RLS), que usan las Edge
-- Functions. Sin políticas, todo acceso desde el cliente queda denegado.
drop policy if exists "webhook_events_service_role" on public.webhook_events;
create policy "webhook_events_service_role"
  on public.webhook_events
  for all
  using (false)
  with check (false);