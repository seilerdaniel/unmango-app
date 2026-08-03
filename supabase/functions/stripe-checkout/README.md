# stripe-checkout — Checkout Session de Stripe (USD)

Crea una **Checkout Session** de Stripe en modo `subscription` en **Dólares**
para los planes **PRO** y **HOGAR** de UnMango (US$9.99 y US$29.99 al mes).
La llama el usuario logueado desde `PricingModal`
(`supabase.functions.invoke`), que manda su JWT de Supabase — por eso
`verify_jwt = true`.

## Qué devuelve

`POST https://<PROJECT_REF>.supabase.co/functions/v1/stripe-checkout`

```json
{ "plan": "pro" }
```

Respuesta `{ "url": "https://checkout.stripe.com/...", "session_id": "cs_..." }`
— la app redirige a `url`, el checkout seguro de Stripe (pagás con tarjeta
internacional, en USD).

## Cómo identifica al usuario

1. Lee el usuario del **JWT** de la request (no confía en el body); valida
   que el `userId` del body, si viene, coincida.
2. Pone `client_reference_id = userId` y `metadata = { plan, userId }` en la
   sesión **y también en `subscription_data.metadata`**: así los eventos de
   webhook (`invoice.payment_succeeded`, `customer.subscription.*`) traen
   siempre el plan y el userId sin tener que consultar la sesión original.

## Prices de Stripe

El Price se resuelve así:

- Si seteas las env vars `STRIPE_PRICE_PRO_ID` / `STRIPE_PRICE_HOGAR_ID`
  (creá los Prices en Stripe Dashboard → Products), la función usa esos
  precios tal cual — **recomendado en producción** para fijar precios.
- Si no, la función crea el Price on-the-fly: producto `UnMango PRO` /
  `UnMango HOGAR`, moneda `usd`, mensual (`recurring[interval]=month`).

## Credenciales (secrets de Supabase)

```bash
supabase secrets set STRIPE_SECRET_KEY=<sk_test_... o sk_live_...>
```

La clave la sacás de [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys).
Usá `sk_test_...` mientras probás y `sk_live_...` al salir a producción.
**Nunca** la exponas al cliente: solo vive en esta Edge Function.

Opcionales:

```bash
supabase secrets set STRIPE_PRICE_PRO_ID=price_xxx     # Price de PRO en USD
supabase secrets set STRIPE_PRICE_HOGAR_ID=price_yyy   # Price de HOGAR en USD
supabase secrets set APP_URL=https://unmango.app       # origen para success/cancel
```

## Desplegar

```bash
supabase functions deploy stripe-checkout
```

Con `verify_jwt = true` en `config.toml`, el deploy lo respeta; la app
involucra la función con el token de sesión automáticamente.
