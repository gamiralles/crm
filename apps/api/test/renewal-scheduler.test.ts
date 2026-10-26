import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createLock: vi.fn(),
  replaceExpiredLock: vi.fn(),
  releaseLock: vi.fn(),
  createRun: vi.fn(),
  findOrganizations: vi.fn(),
  retryDeliveries: vi.fn(),
}))

vi.mock('../src/models/scheduler-lock.js', () => ({ SchedulerLockModel: { create: mocks.createLock, findOneAndUpdate: mocks.replaceExpiredLock, updateOne: mocks.releaseLock } }))
vi.mock('../src/models/scheduler-run.js', () => ({ SchedulerRunModel: { create: mocks.createRun } }))
vi.mock('../src/models/organization.js', () => ({ OrganizationModel: { find: mocks.findOrganizations } }))
vi.mock('../src/notifications/service.js', () => ({ queueNotificationDeliveries: vi.fn(), retryFailedDeliveries: mocks.retryDeliveries }))

import { runRenewalSweep } from '../src/renewals/service.js'
import { loadConfig } from '../src/config.js'

const config = loadConfig({ NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1:27017/crm_test', SESSION_SECRET: 'a-random-test-secret-with-more-than-32-characters' })
let runRecord: { id: string; status: string; finishedAt?: Date; summary?: object; error?: string; save: ReturnType<typeof vi.fn> }

describe('bloqueo distribuido del barrido de renovaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runRecord = { id: 'run-id', status: 'running', save: vi.fn().mockResolvedValue(undefined) }
    mocks.createLock.mockResolvedValue({})
    mocks.replaceExpiredLock.mockResolvedValue({ _id: 'renewal-sweep' })
    mocks.releaseLock.mockResolvedValue({ modifiedCount: 1 })
    mocks.createRun.mockResolvedValue(runRecord)
    mocks.findOrganizations.mockReturnValue({ select: () => ({ lean: async () => [] }) })
    mocks.retryDeliveries.mockResolvedValue({ retried: 0 })
  })

  it('registra una ejecución y libera el bloqueo cuando termina', async () => {
    const result = await runRenewalSweep(config)

    expect(result).toMatchObject({ runId: 'run-id', organizations: 0 })
    expect(result).not.toHaveProperty('skipped')
    expect(runRecord.status).toBe('completed')
    expect(mocks.releaseLock).toHaveBeenCalledWith(
      { _id: 'renewal-sweep', ownerId: expect.any(String) },
      { $set: { lockedUntil: new Date(0) } },
    )
  })

  it('omite y deja registrada una ejecución si otra instancia mantiene el bloqueo', async () => {
    mocks.createLock.mockRejectedValue({ code: 11000 })
    mocks.replaceExpiredLock.mockResolvedValue(null)

    const result = await runRenewalSweep(config)

    expect(result).toMatchObject({ runId: 'run-id', skipped: true, reason: 'already_running' })
    expect(mocks.createRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }))
    expect(mocks.findOrganizations).not.toHaveBeenCalled()
    expect(mocks.releaseLock).not.toHaveBeenCalled()
  })

  it('recupera un bloqueo vencido y lo libera aun cuando el barrido falla', async () => {
    mocks.createLock.mockRejectedValue({ code: 11000 })
    mocks.findOrganizations.mockReturnValue({ select: () => ({ lean: async () => { throw new Error('fallo de prueba') } }) })

    await expect(runRenewalSweep(config)).rejects.toThrow('fallo de prueba')

    expect(mocks.replaceExpiredLock).toHaveBeenCalled()
    expect(runRecord.status).toBe('failed')
    expect(runRecord.error).toBe('fallo de prueba')
    expect(mocks.releaseLock).toHaveBeenCalled()
  })
})
