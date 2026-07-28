-- =============================================================
-- UnMango — Cron de recordatorios reales (Fase 5, infraestructura)
--
-- Antes de correr esto:
--   1. Desplegar la Edge Function (ver el README.md en
--      supabase/functions/send-renewal-reminders/).
--   2. Reemplazar <PROJECT_REF> por el ID de tu proyecto Supabase
--      (lo ves en la URL del dashboard o en Settings > General).
--   3. Reemplazar <CRON_SECRET> por el mismo valor exacto que
--      configuraste con `supabase secrets set CRON_SECRET=...`.
--   4. Reemplazar <SUPABASE_ANON_KEY> por tu anon/public key
--      (Settings > API en el dashboard). Es pública, no es un secreto —
--      Supabase la exige igual en el header Authorization de TODA Edge
--      Function por defecto, antes de que la request llegue a nuestro
--      código. Sin este header da "UNAUTHORIZED_NO_AUTH_HEADER".
--
-- Qué hace: programa un job que, todos los días a las 13:00 UTC
-- (10:00 ARG en horario estándar), le pega un POST a la Edge Function.
-- La función en sí decide a quién avisar (no hace falta correrla más
-- seguido que una vez al día).
--
-- Si ya habías corrido una versión anterior de este archivo (sin el
-- header Authorization) y te quedó un job con errores: no hace falta
-- borrarlo a mano. cron.schedule() con el mismo nombre de job
-- ('send-renewal-reminders-daily') actualiza el job existente en vez de
-- crear uno duplicado — con volver a correr este archivo corregido
-- alcanza.
-- =============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-renewal-reminders-daily',
  '0 13 * * *', -- ajustá la hora UTC a lo que te convenga
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-renewal-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =============================================================
-- Gestión del cron una vez creado
-- =============================================================

-- Ver todos los jobs programados:
-- select * from cron.job;

-- Ver el historial de corridas (útil para debuggear si algo falla):
-- select * from cron.job_run_details order by start_time desc limit 20;

-- Pausar el job sin borrarlo:
-- select cron.unschedule('send-renewal-reminders-daily');
