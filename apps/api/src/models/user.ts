import { Schema, model, type InferSchemaType } from 'mongoose'

const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  passwordHash: { type: String, required: true, select: false },
  isActive: { type: Boolean, default: true, required: true },
}, { timestamps: true, versionKey: false })

export type User = InferSchemaType<typeof userSchema>
export const UserModel = model('User', userSchema)
