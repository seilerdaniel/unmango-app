-- =============================================================
-- UnMango — Íconos por categoría
--
-- Correr después de todos los SQL anteriores.
-- =============================================================

alter table public.categories
  add column if not exists icon text;
