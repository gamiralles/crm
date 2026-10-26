import { Schema, model, type InferSchemaType } from 'mongoose'

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  timeZone: { type: String, required: true, default: 'America/Argentina/Buenos_Aires' },
  currency: { type: String, required: true, default: 'ARS', uppercase: true },
  renewalAlertDays: { type: [Number], required: true, default: [30, 15, 7, 0], validate: (days: number[]) => days.length <= 12 && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 365) },
}, { timestamps: true, versionKey: false })

export type Organization = InferSchemaType<typeof organizationSchema>
export const OrganizationModel = model('Organization', organizationSchema)
