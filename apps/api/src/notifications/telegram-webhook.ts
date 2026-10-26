import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { AppConfig } from '../config.js'
import { TelegramLinkModel } from '../models/telegram-link.js'
import { NotificationPreferenceModel } from '../models/notification-preference.js'

export function createTelegramWebhookRouter(config: AppConfig) {
  const router = Router()
  router.post('/webhook', async (req, res) => {
    if (!config.TELEGRAM_WEBHOOK_SECRET || !sameSecret(req.get('x-telegram-bot-api-secret-token') ?? '', config.TELEGRAM_WEBHOOK_SECRET)) { res.status(401).json({ ok: false }); return }
    const update = req.body as { message?: { text?: string; chat?: { id?: number | string } } }
    const match = update.message?.text?.match(/^\/start\s+([A-Za-z0-9_-]{20,80})$/)
    const chatId = update.message?.chat?.id
    const token = match?.[1]
    if (!token || chatId === undefined) { res.json({ ok: true }); return }
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const link = await TelegramLinkModel.findOneAndUpdate({ tokenHash, expiresAt: { $gt: new Date() }, consumedAt: { $exists: false } }, { $set: { consumedAt: new Date() } }, { new: true })
    if (link) await NotificationPreferenceModel.updateOne({ organizationId: link.organizationId, userId: link.userId }, { $set: { telegramChatId: String(chatId), 'channels.telegram': true }, $setOnInsert: { organizationId: link.organizationId, userId: link.userId } }, { upsert: true })
    res.json({ ok: true })
  })
  return router
}

function sameSecret(candidate: string, expected: string) { return timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(expected).digest()) }
