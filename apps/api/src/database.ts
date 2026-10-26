import mongoose from 'mongoose'
import { logger } from './logger.js'
import type { AppConfig } from './config.js'

export async function connectDatabase(uri: string, environment: AppConfig['NODE_ENV'] = 'development'): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: environment !== 'production' })
  logger.info({ database: 'connected' }, 'Conexión con MongoDB establecida')
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}

export function databaseIsReady(): boolean {
  return mongoose.connection.readyState === 1
}

