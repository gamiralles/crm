import { Schema, model } from 'mongoose'

const base = { organizationId: { type: Schema.Types.ObjectId, required: true, index: true }, createdBy: { type: Schema.Types.ObjectId, required: true } }
const quoteSchema = new Schema({ ...base, clientId: { type: Schema.Types.ObjectId, required: true }, companyId: { type: Schema.Types.ObjectId, required: true }, policyId: Schema.Types.ObjectId, line: { type: String, required: true, trim: true, maxlength: 80 }, quotedAt: { type: Date, required: true }, amount: { type: Number, min: 0 }, status: { type: String, enum: ['draft','sent','accepted','rejected','issued'], default: 'draft' }, notes: { type: String, maxlength: 3000 } }, { timestamps: true, versionKey: false })
quoteSchema.index({ organizationId: 1, status: 1, quotedAt: -1 })
const claimSchema = new Schema({ ...base, clientId: { type: Schema.Types.ObjectId, required: true }, policyId: { type: Schema.Types.ObjectId, required: true }, companyId: { type: Schema.Types.ObjectId, required: true }, occurredAt: { type: Date, required: true }, claimType: { type: String, required: true, trim: true, maxlength: 100 }, description: { type: String, required: true, maxlength: 3000 }, status: { type: String, enum: ['reported','in_review','waiting','resolved','closed'], default: 'reported' }, notes: { type: String, maxlength: 3000 } }, { timestamps: true, versionKey: false })
claimSchema.index({ organizationId: 1, status: 1, occurredAt: -1 })
const transactionSchema = new Schema({ ...base, kind: { type: String, enum: ['income','expense'], required: true }, category: { type: String, required: true, trim: true, maxlength: 80 }, amount: { type: Number, required: true, min: 0.01 }, occurredAt: { type: Date, required: true }, clientId: Schema.Types.ObjectId, policyId: Schema.Types.ObjectId, companyId: Schema.Types.ObjectId, notes: { type: String, maxlength: 2000 } }, { timestamps: true, versionKey: false })
transactionSchema.index({ organizationId:  1, occurredAt: -1 })
const commissionSchema = new Schema({ ...base, companyId: { type: Schema.Types.ObjectId, required: true }, policyId: Schema.Types.ObjectId, clientId: Schema.Types.ObjectId, period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, amount: { type: Number, required: true, min: 0.01 }, expectedAt: Date, invoicedAt: Date, collectedAt: Date, status: { type: String, enum: ['pending_invoice','invoiced','collected'], default: 'pending_invoice' }, notes: { type: String, maxlength: 2000 } }, { timestamps: true, versionKey: false })
commissionSchema.index({ organizationId: 1, status: 1, period: -1 })
const eventSchema = new Schema({ ...base, title: { type: String, required: true, trim: true, maxlength: 180 }, description: { type: String, maxlength: 2000 }, startAt: { type: Date, required: true }, endAt: { type: Date, required: true }, allDay: { type: Boolean, default: false }, taskId: Schema.Types.ObjectId, externalProvider: { type: String, enum: ['microsoft'] }, externalId: String, syncStatus: { type: String, enum: ['local','synced','pending','error'], default: 'local' } }, { timestamps: true, versionKey: false })
eventSchema.index({ organizationId: 1, startAt: 1 })
eventSchema.index({ organizationId: 1, externalProvider: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } })
export const QuoteModel = model('Quote', quoteSchema)
export const ClaimModel = model('Claim', claimSchema)
export const CashTransactionModel = model('CashTransaction', transactionSchema)
export const CommissionModel = model('Commission', commissionSchema)
export const CalendarEventModel = model('CalendarEvent', eventSchema)
