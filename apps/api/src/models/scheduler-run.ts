import { Schema, model, type InferSchemaType } from 'mongoose'

const schedulerRunSchema = new Schema({
  jobName: { type: String, required: true, maxlength: 80 },
  status: { type: String, enum: ['running', 'completed', 'failed', 'skipped'], required: true },
  startedAt: { type: Date, required: true },
  finishedAt: Date,
  summary: { organizations: Number, generatedTasks: Number, createdNotifications: Number, retriedDeliveries: Number },
  error: { type: String, maxlength: 500 },
}, { versionKey: false })

schedulerRunSchema.index({ jobName: 1, startedAt: -1 })

export type SchedulerRun = InferSchemaType<typeof schedulerRunSchema>
export const SchedulerRunModel = model('SchedulerRun', schedulerRunSchema)
