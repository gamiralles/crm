import express from 'express'
import type { Express } from 'express'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { connectDatabase } from './database.js'
import { logger } from './logger.js'
import { runMigrations } from './migrations/runner.js'

let appPromise: Promise<Express> | undefined

async function initializeApp(): Promise<Express> {
  const config = loadConfig()
  logger.level = config.LOG_LEVEL
  await connectDatabase(config.MONGODB_URI, config.NODE_ENV)
  await runMigrations()
  return createApp(config)
}

const vercelHandler = express()
vercelHandler.use(async (req, res) => {
  try {
    appPromise ??= initializeApp().catch((error: unknown) => {
      appPromise = undefined
      throw error
    })
    const app = await appPromise
    app(req, res)
  } catch (error) {
    logger.error({ err: error }, 'No se pudo inicializar la API en Vercel')
    if (!res.headersSent) res.status(503).json({ error: { code: 'service_unavailable', message: 'La API no está disponible temporalmente.' } })
  }
})

export default vercelHandler
