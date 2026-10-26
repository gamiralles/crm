import { Schema, model } from 'mongoose'

const integrationSchema = new Schema({ organizationId:{type:Schema.Types.ObjectId,required:true,unique:true}, encryptedAccessToken:{type:String,required:true}, encryptedRefreshToken:{type:String,required:true}, expiresAt:{type:Date,required:true}, scope:{type:String,required:true}, connectedAt:{type:Date,required:true}, lastSyncAt:Date },{versionKey:false})
const stateSchema = new Schema({ stateHash:{type:String,required:true,unique:true}, codeVerifier:{type:String,required:true}, organizationId:{type:Schema.Types.ObjectId,required:true}, userId:{type:Schema.Types.ObjectId,required:true}, expiresAt:{type:Date,required:true,expires:0} },{versionKey:false})
export const MicrosoftIntegrationModel = model('MicrosoftIntegration',integrationSchema)
export const MicrosoftOAuthStateModel = model('MicrosoftOAuthState',stateSchema)
