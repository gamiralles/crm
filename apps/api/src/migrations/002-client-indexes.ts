import { ClientActivityModel } from '../models/client-activity.js'
import { ClientModel } from '../models/client.js'

export const id = '002-client-indexes'

export async function up(): Promise<void> {
  await Promise.all([ClientModel.createIndexes(), ClientActivityModel.createIndexes()])
}
