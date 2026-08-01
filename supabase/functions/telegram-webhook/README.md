# Bot de Telegram para cargar gastos

Mandale un mensaje al bot tipo `Gasto 4500 café` y UnMango lo registra
automáticamente. No pude hacer estos pasos por vos porque requieren que
crees tu propio bot en Telegram (gratis, pero es una cuenta/token que
solo vos podés generar).

## Comandos del bot

Una vez vinculado, además de mandar gastos en texto libre (`Gasto 4500
café`, `12000 supermercado`) entendés estos comandos:

- `/saldo` — tu saldo total en billeteras.
- `/gastado` — cuánto gastaste este mes y qué porcentaje de tu ingreso
  representa.
- `/safetospend` — cuánto podés gastar hoy sin romper tus compromisos
  (gastos fijos, presupuestos, metas de ahorro y cuotas del mes).
- `/ayuda` — lista de comandos.

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

Tenés dos opciones:

### Opción A — Script helper (recomendado)

El repositorio incluye un script que consulta el estado del webhook
(`getWebhookInfo`) y lo setea/saca por vos. PowerShell:

```powershell
# Consultar el estado actual (también te avisa si hay un error reportado)
$env:TELEGRAM_BOT_TOKEN = "<el token de BotFather>"
node scripts/telegram-webhook.mjs info

# Setear el webhook apuntando a tu función desplegada. Si no pasás
# --secret, genera uno nuevo y te imprime el comando para setearlo en
# Supabase (usá el MISMO valor acá y en supabase secrets set).
$env:TELEGRAM_WEBHOOK_SECRET = "<el mismo secreto del paso 2>"
node scripts/telegram-webhook.mjs set --url https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook

# Sacar el webhook (si ya no querés usarlo)
node scripts/telegram-webhook.mjs unset
```

### Opción B — curl

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
va a registrarse como un gasto real en tu cuenta, y los comandos
`/saldo`, `/gastado` y `/safetospend` van a responder con tus datos.
