import { Schema, model, type InferSchemaType } from 'mongoose'

const renewalSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  policyId: { type: Schema.Types.ObjectId, required: true },
  clientId: { type: Schema.Types.ObjectId, required: true },
  termVersion: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending_contact', 'contacted', 'quoting', 'renewing', 'renewed', 'not_renewed'], required: true, default: 'pending_contact' },
  contacts: [{ contactedAt: Date, medium: { type: String, enum: ['phone', 'email', 'whatsapp', 'in_person', 'other'] }, result: String, notes: String, actorId: Schema.Types.ObjectId }],
  nextAction: { type: String, trim: true, maxlength: 240 },
  nextFollowUpAt: Date,
  taskIds: [{ type: Schema.Types.ObjectId }],
  completedAt: Date,
  completion: { policyNumber: String, startDate: Date, endDate: Date, notes: String },
}, { timestamps: true, versionKey: false })

renewalSchema.index({ organizationId: 1, policyId: 1, termVersion: 1 }, { unique: true })
renewalSchema.index({ organizationId: 1, dueDate: 1, status: 1 })
renewalSchema.index({ organizationId: 1, nextFollowUpAt: 1, status: 1 })

export type Renewal = InferSchemaType<typeof renewalSchema>
export const RenewalModel = model('Renewal', renewalSchema)
