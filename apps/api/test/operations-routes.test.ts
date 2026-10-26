import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/auth/middleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => { req.auth = { userId: '507f1f77bcf86cd799439011', organizationId: '507f1f77bcf86cd799439012', role: 'owner' }; next() },
  requireOwner: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))
const mocks = vi.hoisted(() => ({ clientExists: vi.fn(), companyExists: vi.fn(), taskCreate: vi.fn(), renewalTask: vi.fn() }))
vi.mock('../src/models/client.js', () => ({ ClientModel: { exists: mocks.clientExists } }))
vi.mock('../src/models/insurance-company.js', () => ({ InsuranceCompanyModel: { exists: mocks.companyExists } }))
vi.mock('../src/models/task.js', () => ({ TaskModel: { create: mocks.taskCreate, findOneAndUpdate: mocks.renewalTask } }))

import { policyRouter } from '../src/policies/routes.js'
import { taskRouter } from '../src/tasks/routes.js'
import { createSchedulerRouter } from '../src/renewals/scheduler-routes.js'
import { createRenewalTask } from '../src/renewals/service.js'
import { errorHandler } from '../src/middleware/error-handler.js'
import { loadConfig } from '../src/config.js'

const config = loadConfig({ NODE_ENV:'test', MONGODB_URI:'mongodb://127.0.0.1:27017/crm_test', SESSION_SECRET:'a-random-test-secret-with-more-than-32-characters', SCHEDULER_SECRET:'scheduler-secret-value-at-least-32-characters', CRON_SECRET:'cron-secret-value-at-least-32-characters' })
function appFor(path: string, router: express.Router) { const app=express();app.use(express.json());app.use(path,router);app.use(errorHandler);return app }

describe('etapas 4 y 5: pólizas, tareas y alertas', () => {
  it('rechaza una póliza con vigencias inválidas antes de consultar relaciones', async () => {
    const response=await request(appFor('/policies',policyRouter)).post('/policies').send({ clientId:'bad', companyId:'bad', policyNumber:'P-1', line:'Auto', startDate:'2026-10-10', endDate:'2026-10-09' })
    expect(response.status).toBe(400)
    expect(mocks.clientExists).not.toHaveBeenCalled()
    expect(mocks.companyExists).not.toHaveBeenCalled()
  })

  it('valida las tareas antes de intentar persistirlas', async () => {
    const response=await request(appFor('/tasks',taskRouter)).post('/tasks').send({ title:'', dueAt:'ayer' })
    expect(response.status).toBe(400)
    expect(mocks.taskCreate).not.toHaveBeenCalled()
  })

  it('genera seguimientos con una clave estable y upsert idempotente', async () => {
    mocks.renewalTask.mockResolvedValue({ id:'task-id' })
    await createRenewalTask('507f1f77bcf86cd799439012','507f1f77bcf86cd799439013','507f1f77bcf86cd799439014','507f1f77bcf86cd799439015',new Date('2026-10-22T00:00:00Z'),'507f1f77bcf86cd799439011','Llamar')
    expect(mocks.renewalTask.mock.calls[0][0]).toEqual({ organizationId:'507f1f77bcf86cd799439012', sourceKey:'renewal-followup:507f1f77bcf86cd799439013:2026-10-22' })
    expect(mocks.renewalTask.mock.calls[0][2]).toMatchObject({ upsert:true, new:true })
  })

  it('protege el proceso programado con una clave de servidor', async () => {
    const response=await request(appFor('/scheduler',createSchedulerRouter(config))).post('/scheduler/renewals/sweep').set('Authorization','Bearer clave-incorrecta')
    expect(response.status).toBe(401)
  })

  it('acepta la ruta GET que invoca Vercel Cron y también la protege', async () => {
    const response=await request(appFor('/scheduler',createSchedulerRouter(config))).get('/scheduler/renewals/sweep').set('Authorization','Bearer clave-incorrecta')
    expect(response.status).toBe(401)
  })
})
