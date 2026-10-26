import { Schema, model, type InferSchemaType } from 'mongoose'

const companySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  contactName: { type: String, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 40 },
  notes: { type: String, trim: true, maxlength: 2000 },
  isActive: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, versionKey: false })

companySchema.index({ organizationId: 1, name: 1 }, { unique: true })

export type InsuranceCompany = InferSchemaType<typeof companySchema>
export const InsuranceCompanyModel = model('InsuranceCompany', companySchema)
