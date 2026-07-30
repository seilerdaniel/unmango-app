# Sincronización con Google Calendar

Tus suscripciones y servicios/alquiler aparecen como eventos en tu
Google Calendar, con recordatorios automáticos (3 días y 1 día antes).

## Lo que ya hiciste (según la conversación)

- [x] Creaste el proyecto en Google Cloud Console.
- [x] Configuraste la pantalla de consentimiento OAuth (Externo, modo
      Testing, con tu email agregado como usuario de prueba).
- [x] Creaste el Client ID y Client Secret de OAuth.
- [x] Los cargaste en Supabase → Authentication → Providers → Google y
      activaste el provider.

## Lo que falta

### 1. Habilitar la Google Calendar API (si todavía no lo hiciste)

Google Cloud Console → **APIs y servicios → Biblioteca** → buscá
"Google Calendar API" → **Habilitar**.

### 2. Agregar el scope de Calendar a la pantalla de consentimiento

**APIs y servicios → Pantalla de consentimiento de OAuth** → **Acceso a
datos** → **Agregar o quitar permisos** → buscá "Google Calendar API" y
marcá:

```
https://www.googleapis.com/auth/calendar.events
```

### 3. Configurar los secrets de la Edge Function

Estos son las MISMAS credenciales que ya cargaste en Supabase Auth,
pero hay que dárselas también a esta función por separado (las Edge
Functions no tienen acceso a los secrets internos de Supabase Auth):

```bash
supabase secrets set GOOGLE_CLIENT_ID=<tu-client-id>
supabase secrets set GOOGLE_CLIENT_SECRET=<tu-client-secret>
```

### 4. Desplegar la función

```bash
supabase functions deploy sync-google-calendar
```

A diferencia de `send-renewal-reminders` y `telegram-webhook`, **NO**
lleva `--no-verify-jwt` — esta función sí requiere que quien la llame
tenga una sesión válida de Supabase (la llama el usuario logueado desde
la app, no un servicio externo).

### 5. Correr `supabase/google_calendar_sync.sql`

Si todavía no lo corriste, andá al SQL Editor de Supabase y corré ese
archivo (después de todos los SQL anteriores).

### 6. Probarlo desde la app

1. Entrá a UnMango → tarjeta "Google Calendar" → **Conectar Google
   Calendar**.
2. Te va a llevar a Google, te va a pedir permiso para gestionar tus
   eventos de calendario — aceptá.
3. Te redirige de vuelta a UnMango, ya conectado.
4. Tocá **Sincronizar ahora**. Deberías ver un mensaje con la cantidad
   de eventos sincronizados.
5. Abrí tu Google Calendar (calendar.google.com) y buscá los eventos —
   deberían aparecer con el emoji 💰 en el título.

## Si algo falla

- **"Error 403: access_denied" al conectar**: tu cuenta de Google no
  está en la lista de "Usuarios de prueba" de la pantalla de
  consentimiento (paso que ya hiciste, pero si usás otra cuenta de
  Google fallaría por esto).
- **"No se pudo renovar el acceso a Google"**: revisá que
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` estén bien seteados como
  secrets de la función (no alcanza con tenerlos solo en Supabase Auth).
- **Se conecta pero no trae `provider_refresh_token`**: Google solo
  manda el refresh_token la PRIMERA vez que autorizás la app (o si
  forzás `prompt=consent` de nuevo, que es lo que ya hace el botón). Si
  ya habías autorizado la app antes sin el scope de Calendar, puede que
  haga falta revocar el acceso desde
  https://myaccount.google.com/permissions y volver a conectar desde
  cero.
- Revisá los logs de la función en Supabase Dashboard → Edge Functions
  → `sync-google-calendar` → Logs.

## Alcance actual (qué sincroniza y qué no, todavía)

Por ahora sincroniza **Suscripciones y Servicios/Alquiler** (tienen una
fecha de vencimiento recurrente clara). **Cuotas y Deudas todavía no**
— la tabla `google_calendar_events` ya está preparada para soportarlas
(columna `source_table` acepta `'installment_purchases'` y `'debts'`),
es cuestión de sumar esa lógica a la función el día que se priorice.

La sincronización es **manual** (botón "Sincronizar ahora"), no
automática — si querés que se sincronice sola todos los días, se puede
agregar un cron igual que en `send-renewal-reminders` (pg_cron +
pg_net llamando a esta función), pero con una consideración: como esta
función valida el JWT del usuario, un cron no puede invocarla
directamente de la misma forma — habría que adaptarla para ese caso.
Quedó fuera de esta primera versión.
