#!/usr/bin/env node
// =============================================================
// UnMango — Herramienta de administración del webhook de Telegram
//
// Usa la Bot API de Telegram directamente (sin dependencias) para:
//   - Consultar el estado del webhook (getWebhookInfo)
//   - Setear/actualizar el webhook apuntando a la Edge Function
//     (setWebhook), con el secret_token para autenticación
//   - Sacar el webhook (deleteWebhook)
//
// Uso:
//   node scripts/telegram-webhook.mjs info
//   node scripts/telegram-webhook.mjs set --url <URL_FUNCTION> [--secret <SECRET>]
//   node scripts/telegram-webhook.mjs unset
//
// El token se lee de la variable de entorno TELEGRAM_BOT_TOKEN (o del
// flag --token). El secret de TELEGRAM_WEBHOOK_SECRET (o del flag
// --secret). Si no pasás --secret en `set`, se genera uno nuevo con
// crypto.randomBytes y se imprime junto al comando para que lo setees
// también en Supabase (supabase secrets set TELEGRAM_WEBHOOK_SECRET=...).
//
// Windows PowerShell:
//   $env:TELEGRAM_BOT_TOKEN = "<tu-token>"
//   node scripts/telegram-webhook.mjs info
// =============================================================

import { randomBytes } from 'node:crypto'

const TELEGRAM_API = 'https://api.telegram.org'

function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=')
      if (eq === -1) {
        flags[arg.slice(2)] = true
      } else {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1)
      }
    } else {
      positional.push(arg)
    }
  }
  return { flags, positional }
}

function readToken(flags) {
  const token = flags.token || process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('Error: falta TELEGRAM_BOT_TOKEN. Setealo con --token=<token> o con la env var TELEGRAM_BOT_TOKEN.')
    process.exit(1)
  }
  return token
}

function readSecret(flags) {
  return flags.secret || process.env.TELEGRAM_WEBHOOK_SECRET || null
}

async function callApi(token, method, body) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok !== true) {
    console.error(`Error llamando ${method}: HTTP ${res.status}`)
    console.error(JSON.stringify(json, null, 2))
    process.exit(1)
  }
  return json
}

function printWebhookInfo(info) {
  const pretty = {
    url: info.url || '(vacío — no hay webhook seteado)',
    pending_update_count: info.pending_update_count ?? 0,
    has_custom_certificate: info.has_custom_certificate ?? false,
    ip_address: info.ip_address || null,
    last_error_date: info.last_error_date ?? null,
    last_error_message: info.last_error_message || null,
    last_success_date: info.last_success_date ?? null,
    max_connections: info.max_connections ?? null,
    allowed_updates: info.allowed_updates ?? null,
  }
  console.log('getWebhookInfo:')
  console.log(JSON.stringify(pretty, null, 2))

  if (info.last_error_message) {
    console.log('\n⚠️  Telegram reporta el último error del webhook:')
    console.log(`   ${info.last_error_message}`)
  }
  if (!info.url) {
    console.log('\nNo hay webhook seteado todavía. Configuralo con:')
    console.log('  node scripts/telegram-webhook.mjs set --url https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook')
  }
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2))
  const command = positional[0]

  if (!command || !['info', 'set', 'unset'].includes(command)) {
    console.log('Uso: node scripts/telegram-webhook.mjs <info|set|unset> [flags]')
    console.log('')
    console.log('  info    — consulta getWebhookInfo (estado actual del webhook)')
    console.log('  set     — setea el webhook: --url <URL> [--secret <SECRET>]')
    console.log('  unset   — saca el webhook (deleteWebhook)')
    process.exit(0)
  }

  const token = readToken(flags)

  if (command === 'info') {
    const { result } = await callApi(token, 'getWebhookInfo')
    printWebhookInfo(result)
    return
  }

  if (command === 'set') {
    const url = flags.url
    if (!url) {
      console.error('Error: falta --url. Ej: --url https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook')
      process.exit(1)
    }

    let secret = readSecret(flags)
    if (!secret) {
      secret = randomBytes(24).toString('hex')
      console.log('Generé un TELEGRAM_WEBHOOK_SECRET nuevo (no estaba seteado ni en --secret ni en la env var).')
      console.log('')
      console.log(`Setéalo también en Supabase para que la función lo valide:`)
      console.log(`  supabase secrets set TELEGRAM_WEBHOOK_SECRET=${secret}`)
      console.log('')
    }

    await callApi(token, 'setWebhook', {
      url,
      secret_token: secret,
      allowed_updates: ['message'],
    })
    console.log('Webhook seteado correctamente:')
    console.log(`  url:          ${url}`)
    console.log(`  secret_token: ${secret}`)
    console.log('')
    console.log('Verificá el estado con: node scripts/telegram-webhook.mjs info')
    return
  }

  if (command === 'unset') {
    await callApi(token, 'deleteWebhook', { drop_pending_updates: false })
    console.log('Webhook eliminado.')
  }
}

main()
