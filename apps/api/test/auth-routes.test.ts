import express from 'express'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const modelMocks = vi.hoisted(() => ({
  userFindOne: vi.fn(),
  membershipFindOne: vi.fn(),
}))

vi.mock('../src/models/user.js', () => ({ UserModel: { findOne: modelMocks.userFindOne } }))
vi.mock('../src/models/membership.js', () => ({ MembershipModel: { findOne: modelMocks.membershipFindOne } }))

import { createAuthRouter } from '../src/auth/routes.js'
import { loadConfig } from '../src/config.js'
import { errorHandler } from '../src/middleware/error-handler.js'

const userId = '507f1f77bcf86cd799439011'
const organizationId = '507f1f77bcf86cd799439012'
const config = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/crm_test',
  SESSION_SECRET: 'a-random-test-secret-with-more-than-32-characters',
  INITIAL_SETUP_KEY: '',
})

function createRouterHarness() {
  const app = express()
  const session = {
    userId: undefined as string | undefined,
    organizationId: undefined as string | undefined,
    regenerate: vi.fn((done: (error?: Error) => void) => done()),
    save: vi.fn((done: (error?: Error) => void) => done()),
    destroy: vi.fn((done: (error?: Error) => void) => done()),
  }
  app.use(express.json())
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'session', { configurable: true, value: session })
    next()
  })
  app.use('/auth', createAuthRouter(config))
  app.use(errorHandler)
  return { app, session }
}

describe('rutas de autenticación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inicia sesión con credenciales válidas y regenera la sesión', async () => {
    const passwordHash = await bcrypt.hash('contrasena segura 123', 4)
    modelMocks.userFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ id: userId, email: 'ana@example.com', fullName: 'Ana Productora', passwordHash }) })
    modelMocks.membershipFindOne.mockReturnValue({ populate: vi.fn().mockResolvedValue({ role: 'owner', organizationId: { id: organizationId, name: 'Mi productoría' } }) })
    const { app, session } = createRouterHarness()

    const response = await request(app).post('/auth/login').send({ email: 'ANA@EXAMPLE.COM', password: 'contrasena segura 123' })

    expect(response.status).toBe(200)
    expect(response.body.data.user).toEqual({ id: userId, email: 'ana@example.com', fullName: 'Ana Productora' })
    expect(response.body.data.organization).toEqual({ id: organizationId, name: 'Mi productoría' })
    expect(session.regenerate).toHaveBeenCalledOnce()
    expect(session.save).toHaveBeenCalledOnce()
    expect(session.userId).toBe(userId)
    expect(session.organizationId).toBe(organizationId)
  })

  it('devuelve un error uniforme para credenciales no válidas', async () => {
    modelMocks.userFindOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })
    const { app } = createRouterHarness()

    const response = await request(app).post('/auth/login').send({ email: 'no-existe@example.com', password: 'cualquier cosa' })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('invalid_credentials')
    expect(response.body.error.message).toBe('El correo o la contraseña no son correctos.')
  })

  it('valida el cuerpo antes de consultar la base de datos', async () => {
    const { app } = createRouterHarness()

    const response = await request(app).post('/auth/login').send({ email: 'no-es-correo', password: '' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(modelMocks.userFindOne).not.toHaveBeenCalled()
  })

  it('mantiene deshabilitado el bootstrap si no hay una clave inicial configurada', async () => {
    const { app } = createRouterHarness()

    const response = await request(app).post('/auth/bootstrap').send({ setupKey: 'clave', organizationName: 'Seguros', fullName: 'Ana', email: 'ana@example.com', password: 'contrasena segura 123' })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('setup_unavailable')
  })
})
