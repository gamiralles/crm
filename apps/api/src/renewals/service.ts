import { randomUUID } from 'node:crypto'
import { ClientModel } from '../models/client.js'
import { PolicyModel } from '../models/policy.js'
import { RenewalModel } from '../models/renewal.js'
import { TaskModel } from '../models/task.js'
import { NotificationModel } from '../models/notification.js'
import { OrganizationModel } from '../models/organization.js'
import { MembershipModel } from '../models/membership.js'
import { NotificationPreferenceModel } from '../models/notification-preference.js'
import type { AppConfig } from '../config.js'
import { queueNotificationDeliveries, retryFailedDeliveries } from '../notifications/service.js'
import { SchedulerRunModel } from '../models/scheduler-run.js'
import { SchedulerLockModel } from '../models/scheduler-lock.js'
import { logger } from '../logger.js'

const sweepLockId = 'renewal-sweep'
const sweepLockDurationMs = 30 * 60_000

export async function createRenewalTask(organizationId: string, renewalId: string, clientId: string, policyId: string, dueAt: Date, createdBy: string, description: string) {
  const sourceKey = `renewal-followup:${renewalId}:${dueAt.toISOString().slice(0, 10)}`
  return TaskModel.findOneAndUpdate({ organizationId, sourceKey }, { $setOnInsert: { organizationId, renewalId, clientId, policyId, sourceKey, title: 'Seguimiento de renovación', description, dueAt, priority: 'high', status: 'pending', createdBy } }, { upsert: true, new: true, setDefaultsOnInsert: true })
}

export async function runRenewalSweep(config: AppConfig, now = new Date()) {
  const ownerId = randomUUID()
  const acquiredAt = new Date()
  const lockedUntil = new Date(acquiredAt.getTime() + sweepLockDurationMs)
  if (!await acquireSweepLock(ownerId, acquiredAt, lockedUntil)) {
    const run = await SchedulerRunModel.create({ jobName: 'renewal-sweep', status: 'skipped', startedAt: now, finishedAt: acquiredAt, summary: { organizations: 0, generatedTasks: 0, createdNotifications: 0, retriedDeliveries: 0 } })
    return { runId: run.id, skipped: true, reason: 'already_running' as const }
  }

  try {
    const run = await SchedulerRunModel.create({ jobName: 'renewal-sweep', status: 'running', startedAt: now })
    try {
      const summary = await performRenewalSweep(config, now)
      run.status = 'completed'
      run.finishedAt = new Date()
      run.summary = summary
      await run.save()
      return { runId: run.id, ...summary }
    } catch (error) {
      run.status = 'failed'
      run.finishedAt = new Date()
      run.error = error instanceof Error ? error.message.slice(0, 500) : 'Error no identificado.'
      await run.save()
      throw error
    }
  } finally {
    try {
      await SchedulerLockModel.updateOne({ _id: sweepLockId, ownerId }, { $set: { lockedUntil: new Date(0) } })
    } catch (error) {
      logger.error({ err: error }, 'No se pudo liberar el bloqueo del proceso de renovaciones')
    }
  }
}

async function acquireSweepLock(ownerId: string, acquiredAt: Date, lockedUntil: Date): Promise<boolean> {
  try {
    await SchedulerLockModel.create({ _id: sweepLockId, ownerId, lockedUntil })
    return true
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
    const lock = await SchedulerLockModel.findOneAndUpdate(
      { _id: sweepLockId, lockedUntil: { $lte: acquiredAt } },
      { $set: { ownerId, lockedUntil } },
      { new: true },
    )
    return Boolean(lock)
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

async function performRenewalSweep(config: AppConfig, now: Date) {
  const orgs = await OrganizationModel.find({}).select('_id timeZone').lean()
  let generatedTasks = 0
  let createdNotifications = 0
  for (const org of orgs) {
    const orgId = org._id.toString()
    const today = localDate(now, org.timeZone)
    const renewals = await RenewalModel.find({ organizationId: org._id, status: { $in: ['pending_contact', 'contacted', 'quoting'] } }).lean()
    const alertDays = org.renewalAlertDays ?? [30, 15, 7, 0]
    const digestLines: string[] = []
    for (const renewal of renewals) {
      const days = Math.round((Date.parse(renewal.dueDate.toISOString().slice(0, 10)) - Date.parse(today)) / 86_400_000)
      if (!alertDays.includes(days)) continue
      const policy = await PolicyModel.findOne({ _id: renewal.policyId, organizationId: org._id, status: 'active' }).lean()
      const client = await ClientModel.findOne({ _id: renewal.clientId, organizationId: org._id }).select('fullName').lean()
      if (!policy || !client) continue
      const key = `renewal-alert:${renewal._id}:${days}`
      const title = days === 0 ? 'La póliza vence hoy' : `La póliza vence en ${days} días`
      digestLines.push(`${title}: ${client.fullName}, póliza ${policy.policyNumber}.`)
      const taskUpdate = await TaskModel.updateOne({ organizationId: orgId, sourceKey: key }, { $setOnInsert: { organizationId: orgId, clientId: renewal.clientId, policyId: policy._id, renewalId: renewal._id, sourceKey: key, title: `Contactar a ${client.fullName} por su renovación`, description: `Póliza ${policy.policyNumber}. Vencimiento ${renewal.dueDate.toISOString().slice(0, 10)}.`, dueAt: new Date(`${today}T12:00:00.000Z`), priority: days <= 7 ? 'urgent' : 'high', status: 'pending' } }, { upsert: true })
      const task = await TaskModel.findOne({ organizationId: orgId, sourceKey: key }).select('_id').lean()
      if (task) await RenewalModel.updateOne({ _id: renewal._id, organizationId: orgId }, { $addToSet: { taskIds: task._id } })
      if (taskUpdate.upsertedCount) generatedTasks++
      const membership = await MembershipModel.findOne({ organizationId: org._id, isActive: true, role: 'owner' }).select('userId').lean()
      if (!membership) continue
      const pref = await NotificationPreferenceModel.findOne({ organizationId: org._id, userId: membership.userId }).lean()
      if (pref?.types?.renewal === false) continue
      const result = await NotificationModel.updateOne({ organizationId: orgId, userId: membership.userId, dedupeKey: key }, { $setOnInsert: { organizationId: orgId, userId: membership.userId, dedupeKey: key, type: 'renewal', title, message: `${client.fullName}: póliza ${policy.policyNumber}.`, relatedType: 'policy', relatedId: policy._id, isRead: false } }, { upsert: true })
      if (result.upsertedCount) {
        createdNotifications++
        const notification = await NotificationModel.findOne({ organizationId: orgId, userId: membership.userId, dedupeKey: key }).select('_id').lean()
        if (notification) await queueNotificationDeliveries(config, notification._id.toString(), orgId, membership.userId.toString(), ['web_push', 'telegram'])
      }
    }
    const owner = await MembershipModel.findOne({ organizationId: org._id, isActive: true, role: 'owner' }).select('userId').lean()
    if (owner) {
      const openTasks = await TaskModel.find({ organizationId: org._id, status: { $in: ['pending', 'in_progress'] }, dueAt: { $lt: new Date(`${shiftDate(today, 1)}T00:00:00.000Z`) } }).select('_id title dueAt clientId policyId').lean()
      for (const task of openTasks) {
        const isOverdue = task.dueAt.toISOString().slice(0, 10) < today
        const kind = isOverdue ? 'task_overdue' : 'task_due'
        const key = `${kind}:${task._id}:${today}`
        const noticeText = isOverdue ? `Tarea atrasada: ${task.title}.` : `Tarea para hoy: ${task.title}.`
        digestLines.push(noticeText)
        const preference = await NotificationPreferenceModel.findOne({ organizationId: org._id, userId: owner.userId }).lean()
        if (preference?.types?.[kind] === false) continue
        const created = await NotificationModel.updateOne({ organizationId: orgId, userId: owner.userId, dedupeKey: key }, { $setOnInsert: { organizationId: orgId, userId: owner.userId, dedupeKey: key, type: kind, title: isOverdue ? 'Tenés tareas atrasadas' : 'Tenés tareas para hoy', message: task.title, relatedType: 'task', relatedId: task._id, isRead: false } }, { upsert: true })
        if (created.upsertedCount) {
          createdNotifications++
          const notification = await NotificationModel.findOne({ organizationId: orgId, userId: owner.userId, dedupeKey: key }).select('_id').lean()
          if (notification) await queueNotificationDeliveries(config, notification._id.toString(), orgId, owner.userId.toString(), ['web_push', 'telegram'])
        }
      }
      const digestKey = `daily-summary:${today}`
      const digestMessage = (digestLines.length ? digestLines : ['No hay vencimientos de pólizas ni tareas vencidas o para hoy.']).slice(0, 30).join('\n').slice(0, 950)
      const digest = await NotificationModel.updateOne({ organizationId: orgId, userId: owner.userId, dedupeKey: digestKey }, { $setOnInsert: { organizationId: orgId, userId: owner.userId, dedupeKey: digestKey, type: 'system', title: 'Resumen diario de seguimiento', message: digestMessage, isRead: false } }, { upsert: true })
      if (digest.upsertedCount) {
        createdNotifications++
        const notification = await NotificationModel.findOne({ organizationId: orgId, userId: owner.userId, dedupeKey: digestKey }).select('_id').lean()
        if (notification) await queueNotificationDeliveries(config, notification._id.toString(), orgId, owner.userId.toString(), ['email'])
      }
    }
  }
  const retriedDeliveries = await retryFailedDeliveries(config)
  return { organizations: orgs.length, generatedTasks, createdNotifications, retriedDeliveries: retriedDeliveries.retried }
}

function localDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(date: string, days: number) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
