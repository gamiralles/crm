import { createServer } from 'node:http'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { connectDatabase, disconnectDatabase } from './database.js'
import { logger } from './logger.js'
import { runMigrations } from './migrations/runner.js'

async function main() {
  const config = loadConfig()
  logger.level = config.LOG_LEVEL
  await connectDatabase(config.MONGODB_URI, config.NODE_ENV)
  await runMigrations()

  const app = createApp(config)
  const sessionStore = app.locals.sessionStore as { close: () => Promise<void> }
  const server = createServer(app)
  server.listen(config.PORT, () => logger.info({ port: config.PORT }, 'API disponible'))

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Apagando la API')
    server.close((error) => {
      if (error) logger.error({ err: error }, 'Error al cerrar el servidor HTTP')
      void sessionStore.close().catch((storeError: unknown) => logger.error({ err: storeError }, 'Error al cerrar las sesiones'))
        .finally(() => disconnectDatabase())
        .finally(() => process.exit(error ? 1 : 0))
    })
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'No se pudo iniciar la API')
  process.exit(1)
})
