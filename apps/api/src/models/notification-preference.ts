import { Schema, model, type InferSchemaType } from 'mongoose'

const preferenceSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  channels: { webPush: { type: Boolean, default: false }, email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false } },
  types: { renewal: { type: Boolean, default: true }, task_due: { type: Boolean, default: true }, task_overdue: { type: Boolean, default: true }, system: { type: Boolean, default: true } },
  telegramChatId: { type: String, maxlength: 80, select: false },
}, { timestamps: true, versionKey: false })

preferenceSchema.index({ organizationId: 1, userId: 1 }, { unique: true })

export type NotificationPreference = InferSchemaType<typeof preferenceSchema>
export const NotificationPreferenceModel = model('NotificationPreference', preferenceSchema)
