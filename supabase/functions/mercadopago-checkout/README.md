# mercadopago-checkout — Link de suscripción recurrente (Preapproval)

Genera el link de checkout recurrente de Mercado Pago en **Pesos
Argentinos** para los planes **PRO** y **HOGAR** de UnMango. La llama el
usuario logueado desde `PricingModal` (`supabase.functions.invoke`), que
manda su JWT de Supabase — por eso `verify_jwt = true`.

## Qué devuelve

`POST https://<PROJECT_REF>.supabase.co/functions/v1/mercadopago-checkout`

```json
{ "plan": "pro" }
```

Respuesta `{ "init_point": "https://www.mercadopago.com.ar/...", "preapproval_id": "..." }`
— la app redirige a `init_point`, el checkout seguro de Mercado Pago.

La `external_reference` del preapproval es `unmango_<userId>_<plan>`; el
webhook la usa para saber a qué usuario/plan activar cuando el pago se
aprueba. La `notification_url` apunta a `mercadopago-webhook`.

## Credenciales (secrets de Supabase)

```bash
supabase secrets set MERCADOPAGO_ACCESS_TOKEN=<tu access token de MP>
```

Opcionales (con default si no las seteas):

```bash
supabase secrets set MERCADOPAGO_PRO_PRICE_ARS=12000      # precio PRO en ARS
supabase secrets set MERCADOPAGO_HOGAR_PRICE_ARS=35000    # precio HOGAR en ARS
supabase secrets set APP_URL=https://unmango.app          # origen para back_url
```

El access token lo generás en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers):
creá una aplicación y usá su **Access Token** (o el `TEST` si vas a
probar con usuarios de prueba).

## Desplegar

```bash
supabase functions deploy mercadopago-checkout
```

Con `verify_jwt = true` en `config.toml`, el deploy lo respeta; la app
involucra la función con el token de sesión automáticamente.
