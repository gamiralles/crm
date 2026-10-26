import type { RequestHandler } from 'express'
import { Types } from 'mongoose'
import { MembershipModel } from '../models/membership.js'
import { UserModel } from '../models/user.js'

export const requireAuth: RequestHandler = async (req, res, next) => {
  const { userId, organizationId } = req.session
  if (!userId || !organizationId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(organizationId)) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Iniciá sesión para continuar.' } })
    return
  }

  const membership = await MembershipModel.findOne({
    userId,
    organizationId,
    isActive: true,
  }).select('role').lean()
  const activeUser = await UserModel.exists({ _id: userId, isActive: true })

  if (!membership || !activeUser) {
    req.session.destroy(() => undefined)
    res.clearCookie(req.app.locals.sessionCookieName, req.app.locals.sessionCookieOptions)
    res.status(401).json({ error: { code: 'unauthorized', message: 'La sesión ya no tiene acceso a este espacio.' } })
    return
  }

  if (membership.role !== 'owner') {
    res.status(403).json({ error: { code: 'forbidden', message: 'Tu rol no tiene permisos para este espacio.' } })
    return
  }

  req.auth = { userId, organizationId, role: membership.role as 'owner' }
  next()
}

export const requireOwner: RequestHandler = (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ error: { code: 'unauthorized', message: 'Iniciá sesión para continuar.' } })
    return
  }
  if (req.auth.role !== 'owner') {
    res.status(403).json({ error: { code: 'forbidden', message: 'No tenés permisos para realizar esta acción.' } })
    return
  }
  next()
}
