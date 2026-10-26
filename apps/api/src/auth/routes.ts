import { randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { Router, type Request } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { Types } from 'mongoose'
import { z } from 'zod'
import type { AppConfig } from '../config.js'
import { AppError } from '../errors.js'
import { MembershipModel } from '../models/membership.js'
import { OrganizationModel } from '../models/organization.js'
import { SetupClaimModel } from '../models/setup-claim.js'
import { UserModel } from '../models/user.js'
import { requireAuth } from './middleware.js'

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
}).strict()

const setupSchema = z.object({
  setupKey: z.string().min(1).max(256),
  organizationName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
}).strict()

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })
const setupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false })
const dummyPasswordHash = bcrypt.hash('invalid-login-placeholder', 12)

export function createAuthRouter(config: AppConfig): Router {
  const router = Router()

  router.post('/bootstrap', setupLimiter, async (req, res) => {
    const input = parseBody(setupSchema, req.body)
    if (!config.INITIAL_SETUP_KEY || !safeSecretEquals(input.setupKey, config.INITIAL_SETUP_KEY)) {
      throw new AppError(403, 'setup_unavailable', 'La configuración inicial no está disponible.')
    }
    if (await OrganizationModel.exists({})) {
      throw new AppError(409, 'setup_completed', 'La configuración inicial ya fue completada.')
    }

    const claimToken = randomUUID()
    const now = new Date()
    try {
      await SetupClaimModel.findOneAndUpdate(
        { _id: 'first-owner', expiresAt: { $lte: now } },
        { $set: { claimToken, expiresAt: new Date(now.getTime() + 10 * 60_000) } },
        { new: true, upsert: true },
      )
    } catch (error) {
      if (isDuplicateKey(error)) throw new AppError(409, 'setup_in_progress', 'La configuración inicial ya está en curso.')
      throw error
    }

    let userId: string | undefined
    let organizationId: string | undefined
    try {
      if (await OrganizationModel.exists({})) throw new AppError(409, 'setup_completed', 'La configuración inicial ya fue completada.')
      const passwordHash = await bcrypt.hash(input.password, 12)
      const user = await UserModel.create({ email: input.email, fullName: input.fullName, passwordHash })
      const createdUserId = user.id
      userId = createdUserId
      const createdOrganizationId = new Types.ObjectId().toString()
      organizationId = createdOrganizationId
      await MembershipModel.create({ userId: createdUserId, organizationId: createdOrganizationId, role: 'owner' })
      const organization = await OrganizationModel.create({ _id: createdOrganizationId, name: input.organizationName, slug: slugFromName(input.organizationName) })
      await SetupClaimModel.deleteOne({ _id: 'first-owner', claimToken })
      await startSession(req, createdUserId, createdOrganizationId)
      res.status(201).json({ data: { user: { id: user.id, email: user.email, fullName: user.fullName }, organization: { id: organization.id, name: organization.name } } })
    } catch (error) {
      if (organizationId) await OrganizationModel.deleteOne({ _id: organizationId })
      if (userId) await UserModel.deleteOne({ _id: userId })
      if (userId || organizationId) {
        await MembershipModel.deleteMany({ ...(userId ? { userId } : {}), ...(organizationId ? { organizationId } : {}) })
      }
      await SetupClaimModel.deleteOne({ _id: 'first-owner', claimToken })
      if (isDuplicateKey(error)) throw new AppError(409, 'setup_conflict', 'Ya existe un registro con esos datos. Revisá el correo e intentá nuevamente.')
      throw error
    }
  })

  router.post('/login', loginLimiter, async (req, res) => {
    const input = parseBody(loginSchema, req.body)
    const user = await UserModel.findOne({ email: input.email, isActive: true }).select('+passwordHash')
    const hashToCheck = user?.passwordHash ?? await dummyPasswordHash
    const passwordMatches = await bcrypt.compare(input.password, hashToCheck)
    if (!user || !passwordMatches) {
      throw new AppError(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.')
    }

    const membership = await MembershipModel.findOne({ userId: user.id, isActive: true }).populate('organizationId', 'name')
    if (!membership || !membership.organizationId || membership.role !== 'owner') {
      throw new AppError(403, 'membership_inactive', 'Tu cuenta no tiene acceso a un espacio activo.')
    }
    const organization = membership.organizationId as unknown as { id: string; name: string }
    await startSession(req, user.id, organization.id)
    res.json({ data: { user: { id: user.id, email: user.email, fullName: user.fullName }, organization: { id: organization.id, name: organization.name } } })
  })

  router.get('/me', requireAuth, async (req, res) => {
    const user = await UserModel.findOne({ _id: req.auth!.userId, isActive: true }).select('email fullName').lean()
    if (!user) throw new AppError(401, 'unauthorized', 'La sesión ya no es válida.')
    const organization = await OrganizationModel.findOne({ _id: req.auth!.organizationId }).select('name timeZone currency').lean()
    if (!organization) throw new AppError(401, 'unauthorized', 'El espacio ya no está disponible.')
    res.json({ data: { user: { id: user._id.toString(), email: user.email, fullName: user.fullName }, organization: { id: organization._id.toString(), name: organization.name, timeZone: organization.timeZone, currency: organization.currency }, role: req.auth!.role } })
  })

  router.post('/logout', requireAuth, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie(config.SESSION_COOKIE_NAME, { httpOnly: true, secure: config.NODE_ENV === 'production' || config.SESSION_SAME_SITE === 'none', sameSite: config.SESSION_SAME_SITE })
      res.status(204).end()
    })
  })

  return router
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) throw new AppError(400, 'validation_error', 'Revisá los datos enviados.')
  return result.data
}

function safeSecretEquals(candidate: string, expected: string): boolean {
  const left = createHash('sha256').update(candidate).digest()
  const right = createHash('sha256').update(expected).digest()
  return timingSafeEqual(left, right)
}

function slugFromName(name: string): string {
  const slug = name.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || `productoria-${randomUUID().slice(0, 8)}`
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}

function startSession(req: Request, userId: string, organizationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error)
      req.session.userId = userId
      req.session.organizationId = organizationId
      req.session.save((saveError) => saveError ? reject(saveError) : resolve())
    })
  })
}
