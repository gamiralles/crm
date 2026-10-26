import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria.'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres.'),
  SESSION_COOKIE_NAME: z.string().min(1).default('crm.sid'),
  SESSION_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  INITIAL_SETUP_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SCHEDULER_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  CRON_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  VAPID_PUBLIC_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[A-Za-z0-9_-]{80,100}$/).optional()),
  VAPID_PRIVATE_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[A-Za-z0-9_-]{40,60}$/).optional()),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),
  SMTP_HOST: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_USER: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  SMTP_PASSWORD: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  SMTP_FROM: z.preprocess((value) => value === '' ? undefined : value, z.string().email().optional()),
  TELEGRAM_BOT_TOKEN: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  TELEGRAM_BOT_USERNAME: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[a-zA-Z0-9_]{5,32}$/).optional()),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[A-Za-z0-9_-]{16,256}$/).optional()),
  MICROSOFT_CLIENT_ID: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  MICROSOFT_CLIENT_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  MICROSOFT_REDIRECT_URI: z.preprocess((value) => value === '' ? undefined : value, z.url().optional()),
  MICROSOFT_TOKEN_ENCRYPTION_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().regex(/^[A-Za-z0-9+/]{43}=$/).optional()),
}).refine((config) => Boolean(config.VAPID_PUBLIC_KEY) === Boolean(config.VAPID_PRIVATE_KEY), { path: ['VAPID_PRIVATE_KEY'], message: 'VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY deben configurarse juntas.' }).refine((config) => {
  const telegramValues = [config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_BOT_USERNAME, config.TELEGRAM_WEBHOOK_SECRET]
  return telegramValues.every(Boolean) || telegramValues.every((value) => !value)
}, { path: ['TELEGRAM_WEBHOOK_SECRET'], message: 'Configurá juntos token, nombre de usuario y secreto del webhook de Telegram.' }).refine((config) => {
  const microsoftValues = [config.MICROSOFT_CLIENT_ID, config.MICROSOFT_CLIENT_SECRET, config.MICROSOFT_REDIRECT_URI, config.MICROSOFT_TOKEN_ENCRYPTION_KEY]
  return microsoftValues.every(Boolean) || microsoftValues.every((value) => !value)
}, { path: ['MICROSOFT_TOKEN_ENCRYPTION_KEY'], message: 'Configurá juntos client ID, client secret, redirect URI y clave de cifrado de Microsoft.' })

export type AppConfig = z.infer<typeof envSchema>

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Configuración inválida del backend:\n${details}`)
  }
  return result.data
}
