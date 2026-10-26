import { Schema, model, type InferSchemaType } from 'mongoose'

const deliverySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  notificationId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  channel: { type: String, enum: ['web_push', 'email', 'telegram'], required: true },
  status: { type: String, enum: ['pending', 'provider_accepted', 'failed', 'skipped'], required: true },
  attemptCount: { type: Number, required: true, default: 0 },
  sentAt: Date,
  lastAttemptAt: Date,
  nextAttemptAt: Date,
  lastError: { type: String, maxlength: 500 },
  externalId: { type: String, maxlength: 200 },
}, { timestamps: true, versionKey: false })

deliverySchema.index({ organizationId: 1, notificationId: 1, channel: 1 }, { unique: true })
deliverySchema.index({ organizationId: 1, status: 1, updatedAt: 1 })

export type NotificationDelivery = InferSchemaType<typeof deliverySchema>
export const NotificationDeliveryModel = model('NotificationDelivery', deliverySchema)
