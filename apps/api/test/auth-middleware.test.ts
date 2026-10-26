import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

const modelMocks = vi.hoisted(() => ({
  membershipFindOne: vi.fn(),
  userExists: vi.fn(),
}))

vi.mock('../src/models/membership.js', () => ({ MembershipModel: { findOne: modelMocks.membershipFindOne } }))
vi.mock('../src/models/user.js', () => ({ UserModel: { exists: modelMocks.userExists } }))

import { requireAuth, requireOwner } from '../src/auth/middleware.js'

const userId = '507f1f77bcf86cd799439011'
const organizationId = '507f1f77bcf86cd799439012'

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    session: { userId, organizationId, destroy: vi.fn((done: (error?: Error) => void) => done()) },
    app: { locals: { sessionCookieName: 'crm.sid', sessionCookieOptions: { httpOnly: true, sameSite: 'lax' } } },
    ...overrides,
  } as unknown as Request
}

function makeResponse() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), clearCookie: vi.fn().mockReturnThis() } as unknown as Response
}

describe('autorización por sesión y organización', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    modelMocks.membershipFindOne.mockReturnValue({ select: () => ({ lean: async () => ({ role: 'owner' }) }) })
    modelMocks.userExists.mockResolvedValue({ _id: userId })
  })

  it('limita la comprobación de membresía a la organización de la sesión', async () => {
    const req = makeRequest({ query: { organizationId: '507f1f77bcf86cd799439099' } })
    const res = makeResponse()
    const next = vi.fn() as unknown as NextFunction

    await requireAuth(req, res, next)

    expect(modelMocks.membershipFindOne).toHaveBeenCalledWith({ userId, organizationId, isActive: true })
    expect(req.auth).toEqual({ userId, organizationId, role: 'owner' })
    expect(next).toHaveBeenCalledOnce()
  })

  it('rechaza la sesión si no existe una membresía activa', async () => {
    modelMocks.membershipFindOne.mockReturnValue({ select: () => ({ lean: async () => null }) })
    const req = makeRequest()
    const res = makeResponse()
    const next = vi.fn() as unknown as NextFunction

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(req.session.destroy).toHaveBeenCalledOnce()
    expect(res.clearCookie).toHaveBeenCalledWith('crm.sid', expect.any(Object))
    expect(next).not.toHaveBeenCalled()
  })

  it('rechaza sesiones sin identidad válida sin consultar modelos', async () => {
    const req = makeRequest({ session: { destroy: vi.fn() } })
    const res = makeResponse()
    const next = vi.fn() as unknown as NextFunction

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(modelMocks.membershipFindOne).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('rechaza membresías con un rol distinto de propietario', async () => {
    modelMocks.membershipFindOne.mockReturnValue({ select: () => ({ lean: async () => ({ role: 'collaborator' }) }) })
    const req = makeRequest()
    const res = makeResponse()
    const next = vi.fn() as unknown as NextFunction

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('deniega el acceso cuando el rol no tiene permiso de propietario', () => {
    const req = makeRequest({ auth: { userId, organizationId, role: 'collaborator' } })
    const res = makeResponse()
    const next = vi.fn() as unknown as NextFunction

    requireOwner(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
