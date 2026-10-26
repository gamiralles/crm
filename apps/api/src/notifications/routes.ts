import { Router } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import { requireAuth, requireOwner } from '../auth/middleware.js'
import { AppError } from '../errors.js'
import { NotificationModel } from '../models/notification.js'
import { NotificationPreferenceModel } from '../models/notification-preference.js'
import { PushSubscriptionModel } from '../models/push-subscription.js'
import { OrganizationModel } from '../models/organization.js'
import { TelegramLinkModel } from '../models/telegram-link.js'

export function createNotificationRouter(config: AppConfig) {
  const router = Router()
  router.use(requireAuth, requireOwner)

  router.get('/settings/renewal-alerts', async (req, res) => {
    const organization = await OrganizationModel.findById(req.auth!.organizationId).select('renewalAlertDays').lean()
    if (!organization) throw new AppError(404, 'not_found', 'No encontramos el espacio de trabajo.')
    res.json({ data: { days: organization.renewalAlertDays } })
  })

  router.patch('/settings/renewal-alerts', async (req, res) => {
    const parsed = z.object({ days: z.array(z.number().int().min(0).max(365)).max(12) }).strict().safeParse(req.body)
    if (!parsed.success || (parsed.success && new Set(parsed.data.days).size !== parsed.data.days.length)) throw new AppError(400, 'validation_error', 'Usá hasta 12 plazos únicos, entre 0 y 365 días.')
    const organization = await OrganizationModel.findByIdAndUpdate(req.auth!.organizationId, { $set: { renewalAlertDays: [...parsed.data.days].sort((a,b)=>b-a) } }, { new: true }).select('renewalAlertDays').lean()
    if (!organization) throw new AppError(404, 'not_found', 'No encontramos el espacio de trabajo.')
    res.json({ data: { days: organization.renewalAlertDays } })
  })

  router.get('/', async (req, res) => {
    const read = req.query.read
    const filter: Record<string, unknown> = { organizationId: req.auth!.organizationId, userId: req.auth!.userId }
    if (read === 'true') filter.isRead = true
    if (read === 'false') filter.isRead = false
    const page = Math.max(1, Math.min(100_000, Number(req.query.page) || 1))
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30))
    const [items, total, unread] = await Promise.all([NotificationModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), NotificationModel.countDocuments(filter), NotificationModel.countDocuments({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, isRead: false })])
    const deliveries = items.length ? await import('../models/notification-delivery.js').then(({ NotificationDeliveryModel }) => NotificationDeliveryModel.find({ organizationId: req.auth!.organizationId, notificationId: { $in: items.map((item) => item._id) } }).lean()) : []
    const byNotification = new Map<string, typeof deliveries>()
    for (const delivery of deliveries) { const key = delivery.notificationId.toString(); byNotification.set(key, [...(byNotification.get(key) ?? []), delivery]) }
    res.json({ data: items.map((item) => ({ id: item._id.toString(), type: item.type, title: item.title, message: item.message, isRead: item.isRead, relatedType: item.relatedType, relatedId: item.relatedId?.toString(), createdAt: item.createdAt, deliveries: (byNotification.get(item._id.toString()) ?? []).map((delivery) => ({ channel: delivery.channel, status: delivery.status, attemptCount: delivery.attemptCount, sentAt: delivery.sentAt, lastError: delivery.lastError })) })), unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  })

  router.patch('/:id/read', async (req, res) => {
    const parsed = z.object({ isRead: z.boolean() }).strict().safeParse(req.body)
    if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá si la notificación está leída.')
    const item = await NotificationModel.findOneAndUpdate({ _id: validId(req.params.id), organizationId: req.auth!.organizationId, userId: req.auth!.userId }, { $set: { isRead: parsed.data.isRead } }, { new: true }).lean()
    if (!item) throw new AppError(404, 'not_found', 'No encontramos esa notificación.')
    res.json({ data: { id: item._id.toString(), isRead: item.isRead } })
  })

  router.get('/preferences', async (req, res) => {
    const pref = await NotificationPreferenceModel.findOneAndUpdate({ organizationId: req.auth!.organizationId, userId: req.auth!.userId }, { $setOnInsert: { organizationId: req.auth!.organizationId, userId: req.auth!.userId } }, { upsert: true, new: true }).select('+telegramChatId').lean()
    res.json({ data: { channels: pref.channels, types: pref.types, telegramLinked: Boolean(pref.telegramChatId) } })
  })

  router.patch('/preferences', async (req, res) => {
    const parsed = z.object({ channels: z.object({ webPush: z.boolean().optional(), email: z.boolean().optional(), telegram: z.boolean().optional() }).strict().optional(), types: z.object({ renewal: z.boolean().optional(), task_due: z.boolean().optional(), task_overdue: z.boolean().optional(), system: z.boolean().optional() }).strict().optional(), telegramChatId: z.string().trim().min(1).max(80).optional() }).strict().safeParse(req.body)
    if (!parsed.success) throw new AppError(400, 'validation_error', 'Revisá tus preferencias de notificación.')
    const set: Record<string, unknown> = {}
    for (const [group, values] of [['channels', parsed.data.channels], ['types', parsed.data.types]] as const) if (values) for (const [key, value] of Object.entries(values)) set[`${group}.${key}`] = value
    if (parsed.data.telegramChatId !== undefined) set.telegramChatId = parsed.data.telegramChatId
    const pref = await NotificationPreferenceModel.findOneAndUpdate({ organizationId: req.auth!.organizationId, userId: req.auth!.userId }, { $set: set, $setOnInsert: { organizationId: req.auth!.organizationId, userId: req.auth!.userId } }, { upsert: true, new: true }).select('+telegramChatId').lean()
    res.json({ data: { channels: pref.channels, types: pref.types, telegramLinked: Boolean(pref.telegramChatId) } })
  })

  router.post('/telegram/link', async (req, res) => {
    if (!config.TELEGRAM_BOT_USERNAME || !config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_WEBHOOK_SECRET) throw new AppError(503, 'telegram_unavailable', 'El bot de Telegram todavía no está configurado en el servidor.')
    const token = randomBytes(24).toString('base64url')
    await TelegramLinkModel.deleteMany({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, consumedAt: { $exists: false } })
    await TelegramLinkModel.create({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 15 * 60_000) })
    res.json({ data: { url: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?start=${token}`, expiresAt: new Date(Date.now() + 15 * 60_000) } })
  })

  router.get('/push/public-key', (_req, res) => res.json({ data: { publicKey: config.VAPID_PUBLIC_KEY ?? null, available: Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) } }))

  router.put('/push-subscription', async (req, res) => {
    const parsed = z.object({ endpoint: z.url().max(2048), keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }).strict() }).strict().safeParse(req.body)
    if (!parsed.success) throw new AppError(400, 'validation_error', 'La suscripción de notificaciones no es válida.')
    await PushSubscriptionModel.findOneAndUpdate({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, endpoint: parsed.data.endpoint }, { $set: { p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, isActive: true, lastError: undefined }, $setOnInsert: { organizationId: req.auth!.organizationId, userId: req.auth!.userId, endpoint: parsed.data.endpoint } }, { upsert: true })
    await NotificationPreferenceModel.updateOne({ organizationId: req.auth!.organizationId, userId: req.auth!.userId }, { $set: { 'channels.webPush': true }, $setOnInsert: { organizationId: req.auth!.organizationId, userId: req.auth!.userId } }, { upsert: true })
    res.status(204).end()
  })

  router.delete('/push-subscription', async (req, res) => {
    const parsed = z.object({ endpoint: z.url().max(2048) }).strict().safeParse(req.body)
    if (!parsed.success) throw new AppError(400, 'validation_error', 'Indicá el dispositivo que querés desconectar.')
    await PushSubscriptionModel.deleteOne({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, endpoint: parsed.data.endpoint })
    const remaining = await PushSubscriptionModel.exists({ organizationId: req.auth!.organizationId, userId: req.auth!.userId, isActive: true })
    await NotificationPreferenceModel.updateOne({ organizationId: req.auth!.organizationId, userId: req.auth!.userId }, { $set: { 'channels.webPush': Boolean(remaining) } })
    res.status(204).end()
  })

  return router
}

function validId(id: string) { if (!Types.ObjectId.isValid(id)) throw new AppError(404, 'not_found', 'No encontramos esa notificación.'); return id }
