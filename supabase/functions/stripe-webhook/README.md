# stripe-webhook — Webhooks de Stripe (suscripciones)

Recibe los **webhooks de Stripe** y activa, renueva o cancela la suscripción
del usuario en la tabla `subscriptions` según el evento:

| Evento                          | Acción                                            |
| ------------------------------- | ------------------------------------------------- |
| `checkout.session.completed`    | Pago inicial aprobado → `status: 'active'`        |
| `invoice.payment_succeeded`     | Cobro mensual → renueva `status: 'active'`        |
| `customer.subscription.updated` | Solo actualiza si `status === 'active'`           |
| `customer.subscription.deleted` | Cancelación → `status: 'canceled'`                |

La invoca Stripe (no trae JWT de Supabase) → `verify_jwt = false`. La
seguridad la da la **firma**: verificamos el header `Stripe-Signature`
(HMAC-SHA256 del body con `STRIPE_WEBHOOK_SECRET`) antes de procesar nada.

## Qué hace

1. Verifica la firma del webhook (`timestamp` dentro de 5 minutos + HMAC).
2. Parsea el evento y extrae el `{ userId, plan }` de forma resiliente:
   `client_reference_id` (sesiones) o `metadata` / `subscription_data.metadata`
   / `subscription_details.metadata` (suscripciones y facturas).
3. Calcula `current_period_end` desde el evento (la suscripción o la línea
   de la factura) y si no viene, cae a **ahora + 30 días**.
4. Hace `upsert` en `subscriptions` (`onConflict: 'user_id'`). En
   `invoice.payment_succeeded`, si el payload no trae la metadata, consulta
   la Subscription en Stripe (que `stripe-checkout` alimentó vía
   `subscription_data.metadata`).
5. Responde **HTTP 200 de inmediato** (Stripe espera un ack rápido) y
   termina el procesamiento en background. El upsert es idempotente.

## Configurar el endpoint en Stripe

En [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks),
agregá un endpoint con la URL:

```
https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook
```

Habilitá los eventos:
`checkout.session.completed`, `invoice.payment_succeeded`,
`customer.subscription.updated` y `customer.subscription.deleted`.

## Credenciales (secrets de Supabase)

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec_...>
supabase secrets set STRIPE_SECRET_KEY=<sk_test_... o sk_live_...>
```

- `STRIPE_WEBHOOK_SECRET`: el signing secret del endpoint, se ve al crearlo
  en el Dashboard (empieza con `whsec_`).
- `STRIPE_SECRET_KEY`: la misma de `stripe-checkout`; se usa solo para
  consultar la Subscription por id cuando el payload no trae la metadata.

## Desplegar

```bash
supabase functions deploy stripe-webhook
```
