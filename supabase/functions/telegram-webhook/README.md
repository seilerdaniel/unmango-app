# Bot de Telegram para cargar gastos

Mandale un mensaje al bot tipo `Gasto 4500 café` y UnMango lo registra
automáticamente. No pude hacer estos pasos por vos porque requieren que
crees tu propio bot en Telegram (gratis, pero es una cuenta/token que
solo vos podés generar).

## Paso 1 — Crear el bot con BotFather

1. Abrí Telegram, buscá **@BotFather** y escribile.
2. Mandale `/newbot`, seguí las instrucciones (nombre del bot, username
   que termine en `bot`).
3. Te va a dar un **token** (algo como `123456789:ABCdefGhIJKlmNoPQRstuVwxYZ`).
   Guardalo, lo necesitás en el paso 2.

## Paso 2 — Configurar los secrets en Supabase

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<el token de BotFather>
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
```

Anotá el valor que generaste para `TELEGRAM_WEBHOOK_SECRET` (corré
`openssl rand -hex 24` suelto primero, copiá el resultado, y usá ESE
mismo valor en el `secrets set` — lo necesitás en el paso 4).

## Paso 3 — Desplegar la función

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
```

El flag `--no-verify-jwt` es necesario acá: Telegram no manda un token
de Supabase en sus requests (manda su propio secreto, que ya validamos
nosotros mismos dentro de la función con `TELEGRAM_WEBHOOK_SECRET`).

## Paso 4 — Decirle a Telegram dónde mandar los mensajes (setWebhook)

```bash
curl -X POST "https://api.telegram.org/bot<TU_BOT_TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook",
    "secret_token": "<EL_MISMO_TELEGRAM_WEBHOOK_SECRET_DEL_PASO_2>"
  }'
```

Deberías recibir `{"ok":true,"result":true,...}`.

## Paso 5 — Vincular tu cuenta de UnMango con el bot

Desde la app: abrí la tarjeta "Vincular Telegram" (en la columna
lateral del dashboard), tocá "Generar código", y te va a mostrar un
número de 6 dígitos. Mandaselo al bot en Telegram (buscá tu bot por el
username que le pusiste y escribile ese número). Te debería responder
confirmando la vinculación.

Después de eso, cualquier mensaje tipo `Gasto 4500 café` que le mandes
va a registrarse como un gasto real en tu cuenta.
