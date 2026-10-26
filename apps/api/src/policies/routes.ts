import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireOwner } from '../auth/middleware.js'
import { AppError } from '../errors.js'
import { ClientModel } from '../models/client.js'
import { InsuranceCompanyModel } from '../models/insurance-company.js'
import { OrganizationModel } from '../models/organization.js'
import { PolicyModel } from '../models/policy.js'
import { RenewalModel } from '../models/renewal.js'

const inputSchema = z.object({ clientId: z.string().regex(/^[a-f\d]{24}$/i), companyId: z.string().regex(/^[a-f\d]{24}$/i), policyNumber: z.string().trim().min(1).max(80), line: z.string().trim().min(2).max(80), startDate: z.iso.date(), endDate: z.iso.date(), notes: z.string().trim().max(3000).optional() }).strict()
const listSchema = z.object({ q: z.string().trim().max(120).optional().default(''), status: z.enum(['active', 'cancelled', 'all']).optional().default('active'), clientId: z.string().regex(/^[a-f\d]{24}$/i).optional(), page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1), limit: z.coerce.number().int().min(1).max(100).optional().default(20) }).strict()

export const policyRouter = Router()
policyRouter.use(requireAuth, requireOwner)

policyRouter.get('/companies', async (req, res) => {
  const items = await InsuranceCompanyModel.find({ organizationId: req.auth!.organizationId, isActive: true }).sort({ name: 1 }).lean()
  res.json({ data: items.map((x) => ({ id: x._id.toString(), name: x.name, contactName: x.contactName, email: x.email, phone: x.phone, notes: x.notes, isActive: x.isActive })) })
})

policyRouter.post('/companies', async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), contactName: z.string().trim().max(120).optional(), email: z.email().optional().or(z.literal('')), phone: z.string().trim().max(40).optional(), notes: z.string().trim().max(2000).optional() }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Ingresá el nombre de la aseguradora.')
  try {
    const company = await InsuranceCompanyModel.create({ ...parsed.data, organizationId: req.auth!.organizationId, createdBy: req.auth!.userId })
    res.status(201).json({ data: { id: company.id, name: company.name, contactName: company.contactName, email: company.email, phone: company.phone, notes: company.notes, isActive: company.isActive } })
  } catch (error) { if (isDuplicate(error)) throw new AppError(409, 'duplicate_company', 'Esa aseguradora ya está cargada.'); throw error }
})

policyRouter.patch('/companies/:id', async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), contactName: z.string().trim().max(120).optional(), email: z.email().optional().or(z.literal('')), phone: z.string().trim().max(40).optional(), notes: z.string().trim().max(2000).optional(), isActive: z.boolean() }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los datos de la aseguradora.')
  const company = await InsuranceCompanyModel.findOneAndUpdate({ _id: validId(req.params.id), organizationId: req.auth!.organizationId }, { $set: parsed.data }, { new: true, runValidators: true }).lean()
  if (!company) throw new AppError(404, 'not_found', 'No encontramos esa aseguradora.')
  res.json({ data: { id: company._id.toString(), name: company.name, contactName: company.contactName, email: company.email, phone: company.phone, notes: company.notes, isActive: company.isActive } })
})

policyRouter.get('/', async (req, res) => {
  const parsed = listSchema.safeParse(req.query)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los filtros.')
  const { q, status, page, limit, clientId } = parsed.data
  const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId }
  if (status !== 'all') filter.status = status
  if (clientId) filter.clientId = clientId
  if (q) { const escaped = escapeRegex(q); filter.$or = [{ policyNumber: { $regex: escaped, $options: 'i' } }, { line: { $regex: escaped, $options: 'i' } }] }
  const [items, total, organization] = await Promise.all([PolicyModel.find(filter).sort({ endDate: 1 }).skip((page - 1) * limit).limit(limit).populate('clientId', 'fullName').populate('companyId', 'name').lean(), PolicyModel.countDocuments(filter), OrganizationModel.findById(req.auth!.organizationId).select('timeZone').lean()])
  const timeZone = organization?.timeZone ?? 'America/Argentina/Buenos_Aires'
  res.json({ data: items.map((item) => serializePolicy(item, timeZone)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

policyRouter.post('/', async (req, res) => {
  const input = parseInput(req.body)
  await validateRelations(req.auth!.organizationId, input)
  const dates = toDates(input.startDate, input.endDate)
  const createdAt = new Date()
  const policy = await PolicyModel.create({ ...input, ...dates, organizationId: req.auth!.organizationId, createdBy: req.auth!.userId, updatedBy: req.auth!.userId, terms: [{ version: 1, policyNumber: input.policyNumber, ...dates, recordedAt: createdAt }] })
  try { await RenewalModel.create({ organizationId: req.auth!.organizationId, policyId: policy.id, clientId: input.clientId, termVersion: 1, dueDate: dates.endDate }) }
  catch (error) { await PolicyModel.deleteOne({ _id: policy.id, organizationId: req.auth!.organizationId }); throw error }
  const [result, organization] = await Promise.all([PolicyModel.findOne({ _id: policy.id, organizationId: req.auth!.organizationId }).populate('clientId', 'fullName').populate('companyId', 'name').lean(), OrganizationModel.findById(req.auth!.organizationId).select('timeZone').lean()])
  res.status(201).json({ data: serializePolicy(result!, organization?.timeZone ?? 'America/Argentina/Buenos_Aires') })
})

policyRouter.get('/:id', async (req, res) => {
  const policy = await getPolicy(req.auth!.organizationId, validId(req.params.id))
  const organization = await OrganizationModel.findById(req.auth!.organizationId).select('timeZone').lean()
  const renewals = await RenewalModel.find({ organizationId: req.auth!.organizationId, policyId: policy._id }).sort({ termVersion: -1 }).lean()
  res.json({ data: { ...serializePolicy(policy, organization?.timeZone ?? 'America/Argentina/Buenos_Aires'), renewals: renewals.map((item) => ({ id: item._id.toString(), termVersion: item.termVersion, dueDate: item.dueDate.toISOString().slice(0, 10), status: item.status })) } })
})

policyRouter.patch('/:id', async (req, res) => {
  const id = validId(req.params.id)
  const input = parseInput(req.body)
  await validateRelations(req.auth!.organizationId, input)
  const existing = await PolicyModel.findOne({ _id: id, organizationId: req.auth!.organizationId }).lean()
  if (!existing) throw notFound()
  const dates = toDates(input.startDate, input.endDate)
  const currentVersion = existing.terms.length
  const updated = await PolicyModel.findOneAndUpdate({ _id: id, organizationId: req.auth!.organizationId }, { $set: { clientId: input.clientId, companyId: input.companyId, policyNumber: input.policyNumber, line: input.line, ...dates, notes: input.notes, updatedBy: req.auth!.userId, ...(currentVersion ? { 'terms.$[current].policyNumber': input.policyNumber, 'terms.$[current].startDate': dates.startDate, 'terms.$[current].endDate': dates.endDate } : {}) } }, { new: true, runValidators: true, ...(currentVersion ? { arrayFilters: [{ 'current.version': currentVersion }] } : {}) }).populate('clientId', 'fullName').populate('companyId', 'name').lean()
  if (existing.endDate.getTime() !== dates.endDate.getTime()) await RenewalModel.updateOne({ organizationId: req.auth!.organizationId, policyId: id, status: { $nin: ['renewed', 'not_renewed'] } }, { $set: { dueDate: dates.endDate, clientId: input.clientId } })
  const organization = await OrganizationModel.findById(req.auth!.organizationId).select('timeZone').lean()
  res.json({ data: serializePolicy(updated!, organization?.timeZone ?? 'America/Argentina/Buenos_Aires') })
})

policyRouter.patch('/:id/status', async (req, res) => {
  const parsed = z.object({ status: z.enum(['active', 'cancelled']) }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá el estado de la póliza.')
  const policy = await PolicyModel.findOneAndUpdate({ _id: validId(req.params.id), organizationId: req.auth!.organizationId }, { $set: { status: parsed.data.status, updatedBy: req.auth!.userId } }, { new: true }).populate('clientId', 'fullName').populate('companyId', 'name').lean()
  if (!policy) throw notFound()
  res.json({ data: serializePolicy(policy, 'America/Argentina/Buenos_Aires') })
})

function parseInput(body: unknown) { const result = inputSchema.safeParse(body); if (!result.success) throw new AppError(400, 'validation_error', 'Revisá los datos de la póliza.'); if (result.data.endDate <= result.data.startDate) throw new AppError(400, 'validation_error', 'El vencimiento debe ser posterior al inicio de vigencia.'); return result.data }
function toDates(start: string, end: string) { return { startDate: new Date(`${start}T00:00:00.000Z`), endDate: new Date(`${end}T00:00:00.000Z`) } }
async function validateRelations(orgId: string, input: z.infer<typeof inputSchema>) { const [client, company] = await Promise.all([ClientModel.exists({ _id: input.clientId, organizationId: orgId, isActive: true }), InsuranceCompanyModel.exists({ _id: input.companyId, organizationId: orgId, isActive: true })]); if (!client) throw new AppError(400, 'invalid_client', 'El cliente no existe, está inactivo o pertenece a otro espacio.'); if (!company) throw new AppError(400, 'invalid_company', 'La aseguradora no existe, está inactiva o pertenece a otro espacio.') }
async function getPolicy(orgId: string, id: string) { const policy = await PolicyModel.findOne({ _id: id, organizationId: orgId }).populate('clientId', 'fullName').populate('companyId', 'name').lean(); if (!policy) throw notFound(); return policy }
function serializePolicy(policy: Record<string, unknown>, timeZone: string) {
  const client = policy.clientId as { _id: Types.ObjectId; fullName: string }
  const company = policy.companyId as { _id: Types.ObjectId; name: string }
  const terms = policy.terms as Array<{ version: number; policyNumber: string; startDate: Date; endDate: Date; recordedAt: Date }> | undefined
  const today = localDate(new Date(), timeZone)
  const end = new Date(policy.endDate as Date).toISOString().slice(0, 10)
  const daysRemaining = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  return { id: (policy._id as Types.ObjectId).toString(), client: { id: client._id.toString(), name: client.fullName }, company: { id: company._id.toString(), name: company.name }, policyNumber: policy.policyNumber, line: policy.line, startDate: new Date(policy.startDate as Date).toISOString().slice(0, 10), endDate: end, daysRemaining, status: policy.status, renewalStatus: policy.renewalStatus, notes: policy.notes, terms: terms?.map((term) => ({ version: term.version, policyNumber: term.policyNumber, startDate: new Date(term.startDate).toISOString().slice(0, 10), endDate: new Date(term.endDate).toISOString().slice(0, 10), recordedAt: term.recordedAt })) ?? [] }
}
function localDate(date: Date, timeZone: string) { const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date); const values = Object.fromEntries(parts.map((part)=>[part.type,part.value])); return `${values.year}-${values.month}-${values.day}` }
function validId(id: string) { if (!Types.ObjectId.isValid(id)) throw notFound(); return id }
function notFound() { return new AppError(404, 'not_found', 'No encontramos esa póliza.') }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000 }
