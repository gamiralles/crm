import { Schema, model, type InferSchemaType } from 'mongoose'

const telegramLinkSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  consumedAt: Date,
}, { timestamps: true, versionKey: false })

telegramLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type TelegramLink = InferSchemaType<typeof telegramLinkSchema>
export const TelegramLinkModel = model('TelegramLink', telegramLinkSchema)
