import nodemailer from 'nodemailer'
import webpush from 'web-push'
import type { AppConfig } from '../config.js'
import { NotificationModel } from '../models/notification.js'
import { NotificationDeliveryModel } from '../models/notification-delivery.js'
import { NotificationPreferenceModel } from '../models/notification-preference.js'
import { PushSubscriptionModel } from '../models/push-subscription.js'
import { UserModel } from '../models/user.js'

const channels = ['web_push', 'email', 'telegram'] as const
type Channel = typeof channels[number]

export async function queueNotificationDeliveries(config: AppConfig, notificationId: string, organizationId: string, userId: string, onlyChannels: readonly Channel[] = channels) {
  const notification = await NotificationModel.findOne({ _id: notificationId, organizationId, userId }).lean()
  if (!notification) return
  const preference = await NotificationPreferenceModel.findOne({ organizationId, userId }).select('+telegramChatId').lean()
  const settings = preference?.channels
  for (const channel of onlyChannels) {
    const enabled = channel === 'web_push' ? settings?.webPush === true : channel === 'email' ? settings?.email === true : settings?.telegram === true
    const delivery = await NotificationDeliveryModel.findOneAndUpdate({ organizationId, notificationId, channel }, { $setOnInsert: { organizationId, notificationId, userId, channel, status: enabled ? 'pending' : 'skipped', attemptCount: 0 } }, { upsert: true, new: true })
    if (enabled && delivery.status === 'pending') await deliver(config, delivery, notification, preference?.telegramChatId ?? undefined)
  }
}

export async function retryFailedDeliveries(config: AppConfig, limit = 50) {
  const deliveries = await NotificationDeliveryModel.find({ status: 'failed', attemptCount: { $lt: 5 }, $or: [{ nextAttemptAt: { $lte: new Date() } }, { nextAttemptAt: { $exists: false } }] }).sort({ updatedAt: 1 }).limit(limit)
  for (const delivery of deliveries) {
    const notification = await NotificationModel.findOne({ _id: delivery.notificationId, organizationId: delivery.organizationId }).lean()
    if (!notification) continue
    const preference = await NotificationPreferenceModel.findOne({ organizationId: delivery.organizationId, userId: delivery.userId }).select('+telegramChatId').lean()
    const enabled = delivery.channel === 'web_push' ? preference?.channels?.webPush : delivery.channel === 'email' ? preference?.channels?.email : preference?.channels?.telegram
    if (!enabled || preference?.types?.[notification.type] === false) { delivery.status = 'skipped'; delivery.lastError = 'El canal o tipo de aviso fue desactivado.'; await delivery.save(); continue }
    await deliver(config, delivery, notification, preference?.telegramChatId ?? undefined)
  }
  return { retried: deliveries.length }
}

async function deliver(config: AppConfig, delivery: { organizationId: unknown; userId: unknown; channel: Channel; attemptCount: number; status: string; lastAttemptAt?: Date | null; nextAttemptAt?: Date | null; sentAt?: Date | null; lastError?: string | null; save: () => Promise<unknown> }, notification: { title: string; message: string }, telegramChatId?: string) {
  delivery.attemptCount += 1
  delivery.lastAttemptAt = new Date()
  delivery.status = 'failed'
  delivery.lastError = undefined
  try {
    if (delivery.channel === 'web_push') await sendPush(config, delivery.organizationId, delivery.userId, notification)
    if (delivery.channel === 'email') await sendEmail(config, delivery.userId, notification)
    if (delivery.channel === 'telegram') await sendTelegram(config, telegramChatId, notification)
    delivery.status = 'provider_accepted'
    delivery.sentAt = new Date()
    delivery.nextAttemptAt = undefined
  } catch (error) {
    delivery.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Error de envío no identificado.'
    delivery.nextAttemptAt = new Date(Date.now() + Math.min(24 * 60 * 60_000, 60_000 * (2 ** delivery.attemptCount)))
  }
  await delivery.save()
}

async function sendPush(config: AppConfig, organizationId: unknown, userId: unknown, notification: { title: string; message: string }) {
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) throw new Error('Web Push no está configurado en el servidor.')
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY)
  const subscriptions = await PushSubscriptionModel.find({ organizationId, userId, isActive: true })
  if (!subscriptions.length) throw new Error('No hay dispositivos suscriptos a Web Push.')
  await Promise.all(subscriptions.map(async (item) => {
    try { await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, JSON.stringify({ title: notification.title, body: notification.message, url: '/notificaciones' })) }
    catch (error) { if (typeof error === 'object' && error !== null && 'statusCode' in error && (error.statusCode === 404 || error.statusCode === 410)) item.isActive = false; item.lastError = error instanceof Error ? error.message.slice(0, 500) : 'Push falló'; await item.save(); throw error }
  }))
}

async function sendEmail(config: AppConfig, userId: unknown, notification: { title: string; message: string }) {
  if (!config.SMTP_HOST || !config.SMTP_FROM) throw new Error('El envío de correo no está configurado en el servidor.')
  const user = await UserModel.findById(userId).select('email').lean()
  if (!user) throw new Error('No encontramos el correo del destinatario.')
  const transporter = nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465, ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' } } : {}) })
  await transporter.sendMail({ from: config.SMTP_FROM, to: user.email, subject: notification.title, text: notification.message })
}

async function sendTelegram(config: AppConfig, chatId: string | undefined, notification: { title: string; message: string }) {
  if (!config.TELEGRAM_BOT_TOKEN) throw new Error('Telegram no está configurado en el servidor.')
  if (!chatId) throw new Error('Vinculá una cuenta de Telegram antes de habilitar este canal.')
  const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: `${notification.title}\n${notification.message}` }), signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Telegram respondió con estado ${response.status}.`)
  const result = await response.json() as { ok?: boolean; result?: { message_id?: number } }
  if (!result.ok) throw new Error('Telegram no confirmó la entrega del mensaje.')
}
