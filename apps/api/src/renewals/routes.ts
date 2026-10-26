import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireOwner } from '../auth/middleware.js'
import { AppError } from '../errors.js'
import { PolicyModel } from '../models/policy.js'
import { RenewalModel } from '../models/renewal.js'
import { TaskModel } from '../models/task.js'
import { createRenewalTask } from './service.js'

export const renewalRouter = Router()
renewalRouter.use(requireAuth, requireOwner)

renewalRouter.get('/', async (req, res) => {
  const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId }
  if (typeof req.query.status === 'string' && ['pending_contact', 'contacted', 'quoting', 'renewed', 'not_renewed'].includes(req.query.status)) filter.status = req.query.status
  const items = await RenewalModel.find(filter).sort({ dueDate: 1 }).populate('clientId', 'fullName').populate('policyId', 'policyNumber endDate').lean()
  res.json({ data: items.map((item) => ({ id: item._id.toString(), status: item.status, dueDate: item.dueDate.toISOString().slice(0, 10), client: { id: (item.clientId as unknown as { _id: Types.ObjectId; fullName: string })._id.toString(), name: (item.clientId as unknown as { fullName: string }).fullName }, policy: { id: (item.policyId as unknown as { _id: Types.ObjectId; policyNumber: string })._id.toString(), number: (item.policyId as unknown as { policyNumber: string }).policyNumber }, nextAction: item.nextAction, nextFollowUpAt: item.nextFollowUpAt?.toISOString().slice(0, 10), contacts: item.contacts.map((contact) => ({ contactedAt: contact.contactedAt, medium: contact.medium, result: contact.result, notes: contact.notes })) })) })
})

renewalRouter.post('/:id/contact', async (req, res) => {
  const parsed = z.object({ medium: z.enum(['phone', 'email', 'whatsapp', 'in_person', 'other']), result: z.string().trim().min(1).max(240), notes: z.string().trim().max(2000).optional(), nextAction: z.string().trim().max(240).optional(), nextFollowUpAt: z.iso.date().optional() }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Completá el medio y el resultado del contacto.')
  const id = validId(req.params.id)
  const renewal = await RenewalModel.findOne({ _id: id, organizationId: req.auth!.organizationId })
  if (!renewal) throw notFound()
  if (renewal.status === 'renewed' || renewal.status === 'not_renewed') throw new AppError(409, 'renewal_closed', 'Este seguimiento ya está cerrado.')
  renewal.contacts.push({ ...parsed.data, contactedAt: new Date(), actorId: new Types.ObjectId(req.auth!.userId) })
  renewal.status = renewal.status === 'pending_contact' ? 'contacted' : renewal.status
  renewal.nextAction = parsed.data.nextAction
  renewal.nextFollowUpAt = parsed.data.nextFollowUpAt ? new Date(`${parsed.data.nextFollowUpAt}T00:00:00.000Z`) : undefined
  await renewal.save()
  await PolicyModel.updateOne({ _id: renewal.policyId, organizationId: req.auth!.organizationId }, { $set: { renewalStatus: renewal.status, updatedBy: req.auth!.userId } })
  if (renewal.nextFollowUpAt) await createRenewalTask(req.auth!.organizationId, renewal.id, renewal.clientId.toString(), renewal.policyId.toString(), renewal.nextFollowUpAt, req.auth!.userId, renewal.nextAction ?? parsed.data.result)
  res.json({ data: { id: renewal.id, status: renewal.status, contactsCount: renewal.contacts.length, nextAction: renewal.nextAction, nextFollowUpAt: renewal.nextFollowUpAt } })
})

renewalRouter.patch('/:id/status', async (req, res) => {
  const parsed = z.object({ status: z.enum(['pending_contact', 'contacted', 'quoting', 'not_renewed']) }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá un estado permitido para el seguimiento.')
  const renewal = await RenewalModel.findOneAndUpdate({ _id: validId(req.params.id), organizationId: req.auth!.organizationId, status: { $nin: ['renewed', 'not_renewed'] } }, { $set: { status: parsed.data.status, ...(parsed.data.status === 'not_renewed' ? { completedAt: new Date() } : {}) } }, { new: true })
  if (!renewal) throw notFound()
  await PolicyModel.updateOne({ _id: renewal.policyId, organizationId: req.auth!.organizationId }, { $set: { renewalStatus: parsed.data.status, updatedBy: req.auth!.userId } })
  if (parsed.data.status === 'not_renewed') await TaskModel.updateMany({ organizationId: req.auth!.organizationId, renewalId: renewal._id, status: { $in: ['pending', 'in_progress'] } }, { $set: { status: 'cancelled' } })
  res.json({ data: { id: renewal.id, status: renewal.status } })
})

renewalRouter.post('/:id/complete', async (req, res) => {
  const parsed = z.object({ policyNumber: z.string().trim().min(1).max(80), startDate: z.iso.date(), endDate: z.iso.date(), notes: z.string().trim().max(2000).optional() }).strict().safeParse(req.body)
  if (!parsed.success || (parsed.success && parsed.data.endDate <= parsed.data.startDate)) throw new AppError(400, 'validation_error', 'Revisá el número de póliza y las nuevas fechas de vigencia.')
  const id = validId(req.params.id)
  let renewal = await RenewalModel.findOne({ _id: id, organizationId: req.auth!.organizationId })
  if (!renewal) throw notFound()
  if (renewal.status === 'not_renewed') throw new AppError(409, 'renewal_closed', 'Este seguimiento ya se cerró como no renovado.')
  if (renewal.status === 'renewed') {
    const prior = await PolicyModel.findOne({ _id: renewal.policyId, organizationId: req.auth!.organizationId, 'terms.renewalId': renewal._id }).lean()
    const term = prior?.terms.find((entry) => entry.renewalId?.toString() === id)
    if (prior && term) {
      await RenewalModel.updateOne({ organizationId: req.auth!.organizationId, policyId: renewal.policyId, termVersion: term.version + 1 }, { $setOnInsert: { organizationId: req.auth!.organizationId, policyId: renewal.policyId, clientId: renewal.clientId, termVersion: term.version + 1, dueDate: term.endDate, status: 'pending_contact' } }, { upsert: true })
      await TaskModel.updateMany({ organizationId: req.auth!.organizationId, renewalId: id, status: { $in: ['pending', 'in_progress'] } }, { $set: { status: 'completed', completedAt: new Date() } })
      res.json({ data: { policyId: prior._id.toString(), renewalId: id, termVersion: term.version, endDate: term.endDate.toISOString().slice(0, 10) } }); return
    }
    throw new AppError(409, 'renewal_closed', 'Este seguimiento ya está cerrado.')
  }
  if (renewal.status !== 'renewing') {
    const started = await RenewalModel.findOneAndUpdate({ _id: id, organizationId: req.auth!.organizationId, status: { $in: ['pending_contact', 'contacted', 'quoting'] } }, { $set: { status: 'renewing', completion: { policyNumber: parsed.data.policyNumber, startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`), endDate: new Date(`${parsed.data.endDate}T00:00:00.000Z`), notes: parsed.data.notes } } }, { new: true })
    if (started) renewal = started
    else { const current = await RenewalModel.findOne({ _id: id, organizationId: req.auth!.organizationId }); if (!current || current.status !== 'renewing') throw new AppError(409, 'renewal_changed', 'El seguimiento cambió. Actualizá la página e intentá nuevamente.'); renewal = current }
  }
  const completion = renewal.completion
  if (!completion?.policyNumber || !completion.startDate || !completion.endDate) throw new AppError(409, 'renewal_incomplete', 'No se pudo recuperar la información guardada para completar esta renovación.')
  let policy = await PolicyModel.findOne({ _id: renewal.policyId, organizationId: req.auth!.organizationId })
  if (!policy) throw notFound()
  let term = policy.terms.find((entry) => entry.renewalId?.toString() === id)
  if (!term) {
    const updated = await PolicyModel.findOneAndUpdate({ _id: renewal.policyId, organizationId: req.auth!.organizationId, status: 'active', endDate: renewal.dueDate }, { $set: { policyNumber: completion.policyNumber, startDate: completion.startDate, endDate: completion.endDate, renewalStatus: 'renewed', updatedBy: req.auth!.userId, ...(completion.notes ? { notes: completion.notes } : {}) }, $push: { terms: { version: renewal.termVersion + 1, policyNumber: completion.policyNumber, startDate: completion.startDate, endDate: completion.endDate, recordedAt: new Date(), renewalId: renewal._id } } }, { new: true, runValidators: true })
    if (updated) policy = updated
    else { policy = await PolicyModel.findOne({ _id: renewal.policyId, organizationId: req.auth!.organizationId }); term = policy?.terms.find((entry) => entry.renewalId?.toString() === id); if (!policy || !term) throw new AppError(409, 'policy_changed', 'La póliza cambió o ya no está activa. Actualizá la ficha e intentá nuevamente.') }
  }
  await RenewalModel.updateOne({ _id: id, organizationId: req.auth!.organizationId }, { $set: { status: 'renewed', completedAt: new Date() } })
  await RenewalModel.updateOne({ organizationId: req.auth!.organizationId, policyId: renewal.policyId, termVersion: renewal.termVersion + 1 }, { $setOnInsert: { organizationId: req.auth!.organizationId, policyId: renewal.policyId, clientId: renewal.clientId, termVersion: renewal.termVersion + 1, dueDate: completion.endDate, status: 'pending_contact' } }, { upsert: true })
  await TaskModel.updateMany({ organizationId: req.auth!.organizationId, renewalId: id, status: { $in: ['pending', 'in_progress'] } }, { $set: { status: 'completed', completedAt: new Date() } })
  res.json({ data: { policyId: policy._id.toString(), renewalId: id, termVersion: renewal.termVersion + 1, endDate: completion.endDate.toISOString().slice(0, 10) } })
})

function validId(id: string) { if (!Types.ObjectId.isValid(id)) throw notFound(); return id }
function notFound() { return new AppError(404, 'not_found', 'No encontramos ese seguimiento de renovación.') }
