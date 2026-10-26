import { Schema, model, type InferSchemaType } from 'mongoose'

const subscriptionSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  endpoint: { type: String, required: true, maxlength: 2048 },
  p256dh: { type: String, required: true, maxlength: 256 },
  auth: { type: String, required: true, maxlength: 256 },
  isActive: { type: Boolean, default: true, required: true },
  lastError: { type: String, maxlength: 500 },
}, { timestamps: true, versionKey: false })

subscriptionSchema.index({ organizationId: 1, userId: 1, endpoint: 1 }, { unique: true })

export type PushSubscription = InferSchemaType<typeof subscriptionSchema>
export const PushSubscriptionModel = model('PushSubscription', subscriptionSchema)
