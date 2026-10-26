import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn(), count: vi.fn(), create: vi.fn(), activityCreate: vi.fn() }))
vi.mock('../src/models/client.js', () => ({ ClientModel: { find: mocks.find, countDocuments: mocks.count, create: mocks.create } }))
vi.mock('../src/models/client-activity.js', () => ({ ClientActivityModel: { create: mocks.activityCreate } }))
vi.mock('../src/auth/middleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => { req.auth = { userId: '507f1f77bcf86cd799439011', organizationId: '507f1f77bcf86cd799439012', role: 'owner' }; next() },
  requireOwner: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { clientRouter } from '../src/clients/routes.js'
import { errorHandler } from '../src/middleware/error-handler.js'

function harness() { const app = express(); app.use(express.json()); app.use('/clients', clientRouter); app.use(errorHandler); return app }

describe('rutas de clientes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('limita búsqueda y conteo a la organización de la sesión', async () => {
    const chain = { sort: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) }
    mocks.find.mockReturnValue(chain); mocks.count.mockResolvedValue(0)
    const response = await request(harness()).get('/clients?q=ana&status=all')
    expect(response.status).toBe(200)
    expect(mocks.find.mock.calls[0][0].organizationId.toString()).toBe('507f1f77bcf86cd799439012')
    expect(mocks.count.mock.calls[0][0].organizationId.toString()).toBe('507f1f77bcf86cd799439012')
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 20, total: 0, pages: 0 })
  })

  it('rechaza campos y datos inválidos antes de persistir', async () => {
    const response = await request(harness()).post('/clients').send({ type: 'person', fullName: 'A', organizationId: 'otro' })
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
