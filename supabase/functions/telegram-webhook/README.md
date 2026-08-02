# Bot de Telegram para controlar tus finanzas

Mandale un mensaje al bot tipo `Gasto 4500 café` y UnMango lo registra
automáticamente. También entendé deudas, cuotas, gastos fijos y metas de
ahorro en texto libre, y responde comandos de consulta (/score, /deudas,
/cuotas, /metas, /fijos, /consejos, /hogar, /billeteras, /vencimientos).
No pude hacer estos pasos
por vos porque requieren que crees tu propio bot en Telegram (gratis,
pero es una cuenta/token que solo vos podés generar).

## Comandos del bot

Una vez vinculado, además de mandar intenciones en texto libre entendés
estos comandos:

- `/saldo` — tu saldo total en billeteras.
- `/gastado` — cuánto gastaste este mes y qué porcentaje de tu ingreso
  representa.
- `/safetospend` — cuánto podés gastar hoy sin romper tus compromisos
  (gastos fijos, presupuestos, metas de ahorro y cuotas del mes).
- `/score` — tu Un Mango Score (salud financiera del mes, 4 pilares).
- `/deudas` — lista de tus deudas pendientes.
- `/cuotas` — lista de tus compras en cuotas (con progreso de pagos).
- `/metas` — lista de tus metas de ahorro (con progreso).
- `/fijos` — lista de tus suscripciones y gastos fijos activos.
- `/consejos` — recomendaciones según tus números.
- `/hogar` — balance de gastos de hogar con tu pareja.
- `/billeteras` — saldo individual de cada billetera (ARS + USD).
- `/vencimientos` — lo que vence en los próximos 30 días (fijos,
  cuotas impagas y deudas), ordenado por fecha y con total a pagar.
- `/resumen` o `/gastos` — gráfico de torta (imagen) con la
  distribución de tus gastos del mes por categoría, y el desglose.
- `/ayuda` — lista de comandos.

Además, el bot muestra un **teclado persistente** con 4 botones rápidos
sobre la caja de texto — `💳 Billeteras`, `📅 Vencimientos`,
`🎯 Safe-to-Spend` y `📊 Mi Score` — que equivalen a esos comandos.
También registra los comandos con `setMyCommands`, así aparecen en el
menú nativo de Telegram (botón "/").

Las respuestas de `/deudas`, `/cuotas` y `/vencimientos` traen un botón
**"✅ Marcar Pagada"** por cada ítem pendiente: tocarlo registra el pago
(descuenta la deuda o marca la cuota como pagada, y crea el movimiento
en tus Gastos) sin tener que escribir nada.

## Intenciones en texto libre

El bot registra lo que le mandes según cómo lo escribas:

- **Gasto**: `Gasto 4500 café` o `12000 supermercado`.
- **Deuda**: `Debo 5000 a Juan` (le debés a Juan) o `Me debe 3000 Pedro`
  (Pedro te debe).
- **Pago de deuda**: `Pagué 5000 a Juan`, `Pago deuda Silvana 45000`,
  `Pago 45000 Silvana` (pagás) o `Cobré 3000 de Pedro` (cobrás).
  Descuenta del saldo pendiente y crea el movimiento en tus Gastos o
  Ingresos.
- **Pago de servicio**: `Pago servicio Netflix 5000`, `Pagué Netflix
  5000` o `Pagué alquiler 20000`. Crea el movimiento en tus Gastos con
  la categoría del servicio.
- **Compra en cuotas**: `Heladera 200000 en 12 cuotas`,
  `Heladera 200000 12 cuotas` o `Compra TV 450000 6 cuotas`.
- **Pago de cuota**: `Pagué cuota Galicia 150000`, `Pago cuota Prestamo
  Provincia` (usa el monto de la cuota según el plan),
  `Pagué 150000 cuota Galicia` o `Pago 1 cuota Heladera` (paga esa
  cuota puntual). Marca la cuota como pagada y crea el movimiento en tus
  Gastos.
- **Gasto fijo / suscripción**: `Suscripción 5000 Netflix`,
  `Alquiler 20000`, `Servicio 3000 luz`, `Cable 3000 mensual` o
  `Fijo 2000 cable`.
- **Meta de ahorro**: `Meta Vacaciones 200000`, `Meta 200000 para
  Vacaciones` o `Ahorrar 50000 para viaje`.

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

Después de eso, cualquier mensaje que le mandes se interpreta según el
formato (gasto, deuda, pago de deuda, pago de servicio, cuotas, fijo o
meta), y los comandos de consulta responden con tus datos reales.
