# mercadopago-webhook — Notificaciones IPN de Mercado Pago

Recibe las **notificaciones IPN / Webhooks de Mercado Pago** y activa (o
renueva) la suscripción del usuario en la tabla `subscriptions` cuando el
pago está aprobado.

La invoca Mercado Pago (no trae JWT de Supabase) → `verify_jwt = false`.

## Qué hace

1. Parsea la notificación: `type` (query string o body) y `data.id`.
2. Descarta eventos que no manejamos (`test`, `merchant_order`, …).
3. Para `preapproval`, `authorized_payment` o `payment`, consulta el
   recurso en la API de Mercado Pago y lee `status` + `external_reference`.
4. Si el status activa (`authorized` para preapproval, `approved` para
   pagos) y la `external_reference` es `unmango_<userId>_<plan>`, hace
   `upsert` en `subscriptions` con `plan`, `status: 'active'` y
   `current_period_end = ahora + 30 días`.
5. Responde **HTTP 200 de inmediato** (Mercado Pago espera un ack rápido)
   y termina el procesamiento en background. El upsert es idempotente
   (`onConflict: 'user_id'`), así que un reintento de MP no duplica nada.

## Configurar el webhook en Mercado Pago

En la app de [Mercado Pago Developers](https://www.mercadopago.com.ar/developers)
→ tu aplicación → **Webhooks**, configurá la URL:

```
https://<PROJECT_REF>.supabase.co/functions/v1/mercadopago-webhook
```

Habilitá los eventos `payment`, `authorized_payment` y `preapproval`
(cobros y cambios de estado de la suscripción).

## Credenciales

```bash
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=<tu access token de MP>
```

Es el mismo access token de `mercadopago-checkout`.

## Desplegar

```bash
supabase functions deploy mercadopago-webhook
```

> **Seguridad**: en producción conviene verificar la firma
> (`X-Signature`) de cada notificación y/o exponer la función con un
> secreto propio. Esta implementación documenta el flujo base; la
> verificación de firma se puede agregar después sin tocar la lógica
> (vive en `core.ts`, que es 100% testeable).
