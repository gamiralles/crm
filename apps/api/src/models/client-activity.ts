import { Schema, model, type InferSchemaType } from 'mongoose'

const clientActivitySchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true },
  clientId: { type: Schema.Types.ObjectId, required: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, enum: ['created', 'updated', 'status_changed'], required: true },
  changedFields: { type: [String], default: [] },
  status: { type: Boolean, default: undefined },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

clientActivitySchema.index({ organizationId: 1, clientId: 1, createdAt: -1 })

export type ClientActivity = InferSchemaType<typeof clientActivitySchema>
export const ClientActivityModel = model('ClientActivity', clientActivitySchema)
