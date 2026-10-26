import { Schema, model, type InferSchemaType } from 'mongoose'

const termSchema = new Schema({
  version: { type: Number, required: true },
  policyNumber: { type: String, required: true, trim: true, maxlength: 80 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  recordedAt: { type: Date, required: true, default: Date.now },
  renewalId: { type: Schema.Types.ObjectId, default: undefined },
}, { _id: false })

const policySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  clientId: { type: Schema.Types.ObjectId, required: true },
  companyId: { type: Schema.Types.ObjectId, required: true },
  policyNumber: { type: String, required: true, trim: true, maxlength: 80 },
  line: { type: String, required: true, trim: true, maxlength: 80 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'cancelled'], required: true, default: 'active' },
  renewalStatus: { type: String, enum: ['pending_contact', 'contacted', 'quoting', 'renewed', 'not_renewed'], required: true, default: 'pending_contact' },
  notes: { type: String, trim: true, maxlength: 3000 },
  terms: { type: [termSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, versionKey: false })

policySchema.index({ organizationId: 1, clientId: 1, endDate: 1 })
policySchema.index({ organizationId: 1, endDate: 1, status: 1 })
policySchema.index({ organizationId: 1, companyName: 1, policyNumber: 1 })

export type Policy = InferSchemaType<typeof policySchema>
export const PolicyModel = model('Policy', policySchema)
