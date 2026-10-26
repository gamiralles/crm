import { Router } from 'express'
import { Types } from 'mongoose'
import { z } from 'zod'
import { requireAuth, requireOwner } from '../auth/middleware.js'
import { AppError } from '../errors.js'
import { ClientModel } from '../models/client.js'
import { PolicyModel } from '../models/policy.js'
import { TaskModel } from '../models/task.js'

const taskQuerySchema = z.object({ status: z.enum(['open','pending','in_progress','completed','cancelled']).optional().default('open'), clientId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict()

export const taskRouter = Router()
taskRouter.use(requireAuth, requireOwner)

taskRouter.get('/', async (req, res) => {
  const parsed = taskQuerySchema.safeParse(req.query)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los filtros de tareas.')
  const { status, clientId } = parsed.data
  const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId }
  if (clientId) filter.clientId = clientId
  if (status === 'open') filter.status = { $in: ['pending', 'in_progress'] }
  else if (['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) filter.status = status
  const tasks = await TaskModel.find(filter).sort({ dueAt: 1 }).limit(200).populate('clientId', 'fullName').populate('policyId', 'policyNumber').lean()
  res.json({ data: tasks.map((task) => ({ id: task._id.toString(), title: task.title, description: task.description, dueAt: task.dueAt.toISOString(), priority: task.priority, status: task.status, client: task.clientId ? { id: (task.clientId as unknown as { _id: Types.ObjectId })._id.toString(), name: (task.clientId as unknown as { fullName: string }).fullName } : undefined, policy: task.policyId ? { id: (task.policyId as unknown as { _id: Types.ObjectId })._id.toString(), number: (task.policyId as unknown as { policyNumber: string }).policyNumber } : undefined })) })
})

taskRouter.get('/:id', async (req, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw new AppError(404, 'not_found', 'No encontramos esa tarea.')
  const task = await TaskModel.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId }).populate('clientId', 'fullName').populate('policyId', 'policyNumber').lean()
  if (!task) throw new AppError(404, 'not_found', 'No encontramos esa tarea.')
  const client = task.clientId as unknown as { _id: Types.ObjectId; fullName: string } | null
  const policy = task.policyId as unknown as { _id: Types.ObjectId; policyNumber: string } | null
  res.json({ data: { id: task._id.toString(), title: task.title, description: task.description, dueAt: task.dueAt.toISOString(), priority: task.priority, status: task.status, createdAt: task.createdAt.toISOString(), completedAt: task.completedAt?.toISOString(), client: client ? { id: client._id.toString(), name: client.fullName } : undefined, policy: policy ? { id: policy._id.toString(), number: policy.policyNumber } : undefined } })
})

taskRouter.post('/', async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(2).max(180), description: z.string().trim().max(3000).optional(), dueAt: z.iso.datetime({ offset: true }), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(), clientId: z.string().regex(/^[a-f\d]{24}$/i).optional(), policyId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá los datos de la tarea.')
  let clientId = parsed.data.clientId
  if (parsed.data.policyId) {
    const policy = await PolicyModel.findOne({ _id: parsed.data.policyId, organizationId: req.auth!.organizationId }).select('clientId').lean()
    if (!policy) throw new AppError(400, 'invalid_policy', 'La póliza no pertenece a este espacio.')
    if (clientId && clientId !== policy.clientId.toString()) throw new AppError(400, 'invalid_relation', 'El cliente seleccionado no coincide con la póliza.')
    clientId = policy.clientId.toString()
  }
  if (clientId && !await ClientModel.exists({ _id: clientId, organizationId: req.auth!.organizationId })) throw new AppError(400, 'invalid_client', 'El cliente no pertenece a este espacio.')
  const task = await TaskModel.create({ ...parsed.data, dueAt: new Date(parsed.data.dueAt), clientId, organizationId: req.auth!.organizationId, createdBy: req.auth!.userId })
  res.status(201).json({ data: { id: task.id, title: task.title, dueAt: task.dueAt, priority: task.priority, status: task.status } })
})

taskRouter.patch('/:id/status', async (req, res) => {
  const parsed = z.object({ status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']) }).strict().safeParse(req.body)
  if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá un estado válido.')
  const task = await TaskModel.findOneAndUpdate({ _id: Types.ObjectId.isValid(req.params.id) ? req.params.id : new Types.ObjectId(), organizationId: req.auth!.organizationId }, { $set: { status: parsed.data.status, completedAt: parsed.data.status === 'completed' ? new Date() : undefined } }, { new: true }).lean()
  if (!task) throw new AppError(404, 'not_found', 'No encontramos esa tarea.')
  res.json({ data: { id: task._id.toString(), status: task.status, completedAt: task.completedAt } })
})
