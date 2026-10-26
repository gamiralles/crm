import { Schema, model, type InferSchemaType } from 'mongoose'

const membershipSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  role: { type: String, enum: ['owner'], required: true, default: 'owner' },
  isActive: { type: Boolean, required: true, default: true },
}, { timestamps: true, versionKey: false })

membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true })
membershipSchema.index({ organizationId: 1, isActive: 1 })

export type Membership = InferSchemaType<typeof membershipSchema>
export const MembershipModel = model('Membership', membershipSchema)
