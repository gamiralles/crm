import { Schema, model, type InferSchemaType } from 'mongoose'

const clientSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  type: { type: String, enum: ['person', 'company'], required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 160 },
  documentNumber: { type: String, trim: true, maxlength: 20, default: undefined },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: undefined },
  phone: { type: String, trim: true, maxlength: 40, default: undefined },
  birthDate: { type: Date, default: undefined },
  address: { type: String, trim: true, maxlength: 240, default: undefined },
  notes: { type: String, trim: true, maxlength: 3000, default: undefined },
  isActive: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  updatedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, versionKey: false })

clientSchema.index({ organizationId: 1, fullName: 1 })
clientSchema.index({ organizationId: 1, isActive: 1, createdAt: -1 })
clientSchema.index({ organizationId: 1, documentNumber: 1 }, { unique: true, partialFilterExpression: { documentNumber: { $type: 'string' } } })

export type Client = InferSchemaType<typeof clientSchema>
export const ClientModel = model('Client', clientSchema)
