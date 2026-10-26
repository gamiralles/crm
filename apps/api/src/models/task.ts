import { Schema, model, type InferSchemaType } from 'mongoose'

const taskSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  clientId: Schema.Types.ObjectId,
  policyId: Schema.Types.ObjectId,
  renewalId: Schema.Types.ObjectId,
  quoteId: Schema.Types.ObjectId,
  claimId: Schema.Types.ObjectId,
  sourceKey: { type: String, maxlength: 180 },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 3000 },
  dueAt: { type: Date, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], required: true, default: 'medium' },
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], required: true, default: 'pending' },
  completedAt: Date,
  createdBy: Schema.Types.ObjectId,
}, { timestamps: true, versionKey: false })

taskSchema.index({ organizationId: 1, dueAt: 1, status: 1 })
taskSchema.index({ organizationId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: 'string' } } })

export type Task = InferSchemaType<typeof taskSchema>
export const TaskModel = model('Task', taskSchema)
