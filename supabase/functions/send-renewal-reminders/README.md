# Recordatorios reales de vencimiento (email)

Esto es lo que hace falta para que un recordatorio de suscripción te
llegue por email aunque no tengas UnMango abierto — a diferencia del
banner "Vencen pronto" dentro de la app (que solo ves si entrás).

No pude hacer estos pasos por vos porque requieren credenciales y una
cuenta en un servicio externo que solo vos podés crear. Es todo código
listo para desplegar; estos son los pasos que te tocan.

## Qué vas a necesitar

- La CLI de Supabase instalada (`npm install -g supabase`) y logueada
  contra tu proyecto (`supabase login`, `supabase link --project-ref <tu-project-ref>`).
- Una cuenta en [Resend](https://resend.com) (tiene plan gratis, ~100
  emails/día / 3000 por mes al momento de escribir esto — confirmá en su
  web porque los límites cambian). Es el servicio que se encarga de
  mandar el email en sí; podrías cambiarlo por SendGrid u otro más
  adelante, la función solo tocaría el fetch a la API de Resend.

## Paso 1 — Crear la cuenta de Resend y conseguir el API key

1. Registrate en https://resend.com
2. En **API Keys**, creá una nueva key y copiala (no se vuelve a mostrar).
3. Por defecto, esta función manda los emails desde
   `onboarding@resend.dev` (la dirección de pruebas de Resend — funciona
   sin configurar nada más, pero es genérica). Cuando quieras que salga
   desde tu propio dominio (ej. `recordatorios@tudominio.com`), verificá
   ese dominio en Resend (**Domains** → **Add Domain**, agregando los
   registros DNS que te piden) y después seteá `REMINDER_FROM_EMAIL` como
   se indica abajo.

## Paso 2 — Configurar los secrets en Supabase

Desde la raíz del repo:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
supabase secrets set CRON_SECRET=$(openssl rand -hex 24)
# Opcional, solo si ya verificaste tu dominio en Resend:
supabase secrets set REMINDER_FROM_EMAIL="UnMango <recordatorios@tudominio.com>"
```

Guardá el valor que generó `CRON_SECRET` (podés verlo con
`supabase secrets list`, aunque por seguridad Supabase no muestra el
valor completo — anotalo vos mismo antes, por ejemplo corriendo primero
`openssl rand -hex 24` suelto, copiando el resultado, y usando ESE mismo
valor en el `secrets set` de arriba). Lo vas a necesitar en el Paso 4.

## Paso 3 — Desplegar la función

```bash
supabase functions deploy send-renewal-reminders
```

## Paso 4 — Programar el cron diario

Abrí `supabase/reminders_cron.sql`, reemplazá `<PROJECT_REF>` (el ID de
tu proyecto) y `<CRON_SECRET>` (el mismo valor exacto del Paso 2), y
corré el archivo en el SQL Editor de Supabase.

## Paso 5 — Probarlo manualmente (sin esperar al cron)

```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-renewal-reminders' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'x-cron-secret: <CRON_SECRET>'
```

El header `Authorization` con tu anon/public key (Settings > API en el
dashboard, es pública, no es un secreto) es obligatorio: el gateway de
Supabase lo exige en toda Edge Function por defecto, antes incluso de
que la request llegue a nuestro código. Sin él da
`{"code":"UNAUTHORIZED_NO_AUTH_HEADER"}` — no tiene nada que ver con
nuestro propio chequeo de `x-cron-secret`, que es una capa aparte.

Deberías recibir un JSON con `checked`, `dueToday` y `usersNotified`. Si
`dueToday` da 0, es normal si no tenés ninguna suscripción venciendo
justo dentro de la ventana de aviso (por defecto, 3 días antes — ver
`REMINDER_DAYS_BEFORE` en `index.ts`).

## Cómo ajustar la anticipación del aviso

Cambiá la constante `REMINDER_DAYS_BEFORE` en `index.ts` (por defecto,
3 días antes del vencimiento) y volvé a desplegar con
`supabase functions deploy send-renewal-reminders`.

## Notas de diseño

- La función usa la **service role key** (inyectada automáticamente por
  Supabase en toda Edge Function) porque necesita mirar las suscripciones
  de todos los usuarios, no solo las de uno — no hay una sesión de
  usuario acá, es un proceso de servidor. Esto es intencional y seguro
  siempre que el `CRON_SECRET` esté bien configurado: sin ese secreto,
  cualquiera podría invocar la función y disparar el envío de emails a
  todos tus usuarios.
- La lógica de "cuántos días faltan" vive en `date-utils.ts`, sin nada
  de Deno, justamente para poder testearla con el mismo Vitest que usa el
  resto del proyecto (`date-utils.test.ts`, 8 tests). Es una copia
  conceptual de la misma lógica que ya tenía
  `RecurringManager.tsx` para el banner "Vencen pronto" — viven
  duplicadas porque corren en runtimes distintos (esto es Deno, fuera del
  build de Next.js), así que si cambiás una, replicá el cambio en la otra.
