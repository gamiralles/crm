import { CalendarEventModel, CashTransactionModel, ClaimModel, CommissionModel, QuoteModel } from '../models/business.js'

export const id = '004-business-indexes'
export async function up(): Promise<void> {
  await Promise.all([CalendarEventModel.createIndexes(), CashTransactionModel.createIndexes(), ClaimModel.createIndexes(), CommissionModel.createIndexes(), QuoteModel.createIndexes()])
}
