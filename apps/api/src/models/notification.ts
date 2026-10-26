import { Schema, model, type InferSchemaType } from 'mongoose'

const notificationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  dedupeKey: { type: String, required: true, maxlength: 220 },
  type: { type: String, enum: ['renewal', 'task_due', 'task_overdue', 'system'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  isRead: { type: Boolean, required: true, default: false },
  relatedType: { type: String, enum: ['policy', 'renewal', 'task'] },
  relatedId: Schema.Types.ObjectId,
}, { timestamps: true, versionKey: false })

notificationSchema.index({ organizationId: 1, userId: 1, dedupeKey: 1 }, { unique: true })
notificationSchema.index({ organizationId: 1, userId: 1, isRead: 1, createdAt: -1 })

export type Notification = InferSchemaType<typeof notificationSchema>
export const NotificationModel = model('Notification', notificationSchema)
