import { Schema, model } from 'mongoose'

const setupClaimSchema = new Schema({
  _id: { type: String, required: true },
  claimToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false })

export const SetupClaimModel = model('SetupClaim', setupClaimSchema)
