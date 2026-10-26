import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { AppError } from '../errors.js'
import { ClientModel } from '../models/client.js'
import { ClientActivityModel } from '../models/client-activity.js'
import { requireAuth, requireOwner } from '../auth/middleware.js'

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined)
const clientSchema = z.object({
  type: z.enum(['person', 'company']),
  fullName: z.string().trim().min(2).max(160),
  documentNumber: optionalText(20).transform((v) => v?.replace(/[.\s-]/g, '')),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional().transform((v) => v ? v.toLowerCase() : undefined),
  phone: optionalText(40),
  birthDate: z.union([z.iso.date(), z.literal('')]).optional().transform((v) => v || undefined),
  address: optionalText(240),
  notes: optionalText(3000),
}).strict()
const querySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
  type: z.enum(['person', 'company', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
}).strict()

export const clientRouter = Router()
clientRouter.use(requireAuth, requireOwner)

clientRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los filtros de búsqueda.')
  const { q, status, type, page, limit } = parsed.data
  const filter: Record<string, unknown> = { organizationId: new Types.ObjectId(req.auth!.organizationId) }
  if (status !== 'all') filter.isActive = status === 'active'
  if (type !== 'all') filter.type = type
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [{ fullName: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { phone: { $regex: escaped, $options: 'i' } }, { documentNumber: { $regex: escaped, $options: 'i' } }]
  }
  const [items, total] = await Promise.all([
    ClientModel.find(filter).sort({ fullName: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    ClientModel.countDocuments(filter),
  ])
  res.json({ data: items.map(toClient), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

clientRouter.post('/', async (req, res) => {
  const input = parseClient(req.body)
  try {
    const client = await ClientModel.create({ ...input, organizationId: req.auth!.organizationId, createdBy: req.auth!.userId, updatedBy: req.auth!.userId })
    await ClientActivityModel.create({ organizationId: req.auth!.organizationId, clientId: client.id, actorId: req.auth!.userId, action: 'created' })
    res.status(201).json({ data: toClient(client.toObject()) })
  } catch (error) { if (isDuplicate(error)) throw duplicateError(); throw error }
})

clientRouter.get('/:id/activity', async (req, res) => {
  const id = validId(req.params.id)
  await findClient(req.auth!.organizationId, id)
  const entries = await ClientActivityModel.find({ organizationId: req.auth!.organizationId, clientId: id }).sort({ createdAt: -1 }).limit(100).lean()
  res.json({ data: entries.map((entry) => ({ id: entry._id.toString(), action: entry.action, changedFields: entry.changedFields, status: entry.status, createdAt: entry.createdAt })) })
})

clientRouter.get('/:id', async (req, res) => {
  const client = await findClient(req.auth!.organizationId, validId(req.params.id))
  res.json({ data: toClient(client) })
})

clientRouter.patch('/:id/status', async (req, res) => {
  const id = validId(req.params.id)
  const parsed = z.object({ isActive: z.boolean() }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá si el cliente queda activo o inactivo.')
  const previous = await ClientModel.findOne({ _id: id, organizationId: req.auth!.organizationId }).select('isActive').lean()
  if (!previous) throw notFound()
  const client = await ClientModel.findOneAndUpdate({ _id: id, organizationId: req.auth!.organizationId }, { $set: { isActive: parsed.data.isActive, updatedBy: req.auth!.userId } }, { new: true, runValidators: true }).lean()
  if (!client) throw notFound()
  if (previous.isActive !== parsed.data.isActive) await ClientActivityModel.create({ organizationId: req.auth!.organizationId, clientId: id, actorId: req.auth!.userId, action: 'status_changed', status: parsed.data.isActive })
  res.json({ data: toClient(client) })
})

clientRouter.patch('/:id', async (req, res) => {
  const id = validId(req.params.id)
  const input = parseClient(req.body)
  try {
    const client = await ClientModel.findOneAndUpdate({ _id: id, organizationId: req.auth!.organizationId }, { $set: { ...input, updatedBy: req.auth!.userId } }, { new: true, runValidators: true }).lean()
    if (!client) throw notFound()
    await ClientActivityModel.create({ organizationId: req.auth!.organizationId, clientId: id, actorId: req.auth!.userId, action: 'updated', changedFields: Object.keys(input) })
    res.json({ data: toClient(client) })
  } catch (error) { if (isDuplicate(error)) throw duplicateError(); throw error }
})

function parseClient(body: unknown) {
  const parsed = clientSchema.safeParse(body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los datos del cliente.')
  if (parsed.data.type === 'company' && parsed.data.birthDate) throw new AppError(400, 'validation_error', 'Las empresas no tienen fecha de nacimiento.')
  return { ...parsed.data, birthDate: parsed.data.birthDate ? new Date(`${parsed.data.birthDate}T00:00:00.000Z`) : undefined }
}
async function findClient(organizationId: string, id: string) {
  const client = await ClientModel.findOne({ _id: id, organizationId }).lean()
  if (!client) throw notFound()
  return client
}
function validId(id: string) { if (!Types.ObjectId.isValid(id)) throw notFound(); return id }
function notFound() { return new AppError(404, 'not_found', 'No encontramos ese cliente.') }
function duplicateError() { return new AppError(409, 'duplicate_document', 'Ya existe un cliente de esta organización con ese documento.') }
function isDuplicate(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000 }
function toClient(client: { _id: Types.ObjectId; [key: string]: unknown }) {
  const { _id, __v: _v, organizationId: _org, createdBy: _createdBy, updatedBy: _updatedBy, ...fields } = client
  const birthDate = fields.birthDate
  return { id: _id.toString(), ...fields, birthDate: birthDate ? new Date(String(birthDate)).toISOString().slice(0, 10) : undefined }
}
