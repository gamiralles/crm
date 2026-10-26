import mongoose from 'mongoose'
import { logger } from '../logger.js'
import * as authIndexes from './001-auth-indexes.js'
import * as clientIndexes from './002-client-indexes.js'
import * as policyRenewalNotificationIndexes from './003-policy-renewal-notification-indexes.js'
import * as businessIndexes from './004-business-indexes.js'
import * as microsoftIndexes from './005-microsoft-indexes.js'

const migrations = [authIndexes, clientIndexes, policyRenewalNotificationIndexes, businessIndexes, microsoftIndexes]

export async function runMigrations(): Promise<void> {
  const database = mongoose.connection.db
  if (!database) throw new Error('La conexión con MongoDB no está lista para ejecutar cambios estructurales.')
  const records = database.collection<{ id: string; appliedAt: Date }>('schemaMigrations')
  await records.createIndex({ id: 1 }, { unique: true })

  for (const migration of migrations) {
    if (await records.findOne({ id: migration.id })) continue
    await migration.up()
    await records.insertOne({ id: migration.id, appliedAt: new Date() })
    logger.info({ migration: migration.id }, 'Migración aplicada')
  }
}
