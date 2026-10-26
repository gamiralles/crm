import { CalendarEventModel } from '../models/business.js'
import { MicrosoftIntegrationModel, MicrosoftOAuthStateModel } from '../models/microsoft-integration.js'

export const id = '005-microsoft-indexes'
export async function up(): Promise<void> {
  await Promise.all([CalendarEventModel.createIndexes(), MicrosoftIntegrationModel.createIndexes(), MicrosoftOAuthStateModel.createIndexes()])
}
