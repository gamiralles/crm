import { Schema, model } from 'mongoose'

const schedulerLockSchema = new Schema({
  _id: { type: String, required: true },
  ownerId: { type: String, required: true },
  lockedUntil: { type: Date, required: true },
}, { versionKey: false, timestamps: false })

export const SchedulerLockModel = model('SchedulerLock', schedulerLockSchema)
