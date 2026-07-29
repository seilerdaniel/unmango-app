-- =============================================================
-- UnMango — Campos nuevos en Suscripciones y Gastos Fijos
--
-- Correr después de todos los SQL anteriores.
--
-- Agrega:
--   payment_method    — con qué medio de pago se factura (texto libre,
--                        mismas opciones que ya usa TransactionForm)
--   membership_type    — tipo de membresía contratada (ej. "Premium",
--                        "Familiar"), texto libre y opcional
--   tax_percentage     — % de impuestos que el monto cargado NO incluye
--                        (ej. IVA, impuesto PAIS en suscripciones del
--                        exterior). Sirve para mostrar el total real que
--                        se termina pagando, sin tener que hacer la
--                        cuenta a mano cada vez.
-- =============================================================

alter table public.recurring_expenses
  add column if not exists payment_method text,
  add column if not exists membership_type text,
  add column if not exists tax_percentage numeric not null default 0;
