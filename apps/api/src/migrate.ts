import { loadConfig } from './config.js'
import { connectDatabase, disconnectDatabase } from './database.js'
import { logger } from './logger.js'
import { runMigrations } from './migrations/runner.js'

async function main() {
  const config = loadConfig()
  logger.level = config.LOG_LEVEL
  await connectDatabase(config.MONGODB_URI, config.NODE_ENV)
  try {
    await runMigrations()
  } finally {
    await disconnectDatabase()
  }
}

main().catch((error: unknown) => {
  logger.fatal({ errorName: error instanceof Error ? error.name : 'UnknownError' }, 'No se pudieron aplicar las migraciones')
  process.exit(1)
})
