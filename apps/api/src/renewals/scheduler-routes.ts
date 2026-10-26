import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { AppConfig } from '../config.js'
import { AppError } from '../errors.js'
import { runRenewalSweep } from './service.js'

export function createSchedulerRouter(config: AppConfig) {
  const router = Router()
  const sweep = async (req: import('express').Request, res: import('express').Response) => {
    const candidate = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const secrets = [config.CRON_SECRET, config.SCHEDULER_SECRET].filter((secret): secret is string => Boolean(secret))
    if (!secrets.some((secret) => safeEquals(candidate, secret))) throw new AppError(401, 'unauthorized', 'La clave del proceso programado no es válida.')
    res.json({ data: await runRenewalSweep(config) })
  }
  router.get('/renewals/sweep', sweep)
  router.post('/renewals/sweep', sweep)
  return router
}

function safeEquals(candidate: string, expected: string) { return timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(expected).digest()) }
