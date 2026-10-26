import cors from 'cors'
import express from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import helmet from 'helmet'
import type { AppConfig } from './config.js'
import { databaseIsReady } from './database.js'
import { AppError } from './errors.js'
import { logger } from './logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { createAuthRouter } from './auth/routes.js'
import { clientRouter } from './clients/routes.js'
import { policyRouter } from './policies/routes.js'
import { renewalRouter } from './renewals/routes.js'
import { taskRouter } from './tasks/routes.js'
import { createSchedulerRouter } from './renewals/scheduler-routes.js'
import { createNotificationRouter } from './notifications/routes.js'
import { createTelegramWebhookRouter } from './notifications/telegram-webhook.js'
import { businessRouter } from './business/routes.js'
import { createOutlookRouter } from './calendar/outlook-routes.js'

export function createApp(config: AppConfig) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.TRUST_PROXY)
  app.locals.sessionCookieName = config.SESSION_COOKIE_NAME
  app.locals.sessionCookieOptions = { httpOnly: true, secure: config.NODE_ENV === 'production' || config.SESSION_SAME_SITE === 'none', sameSite: config.SESSION_SAME_SITE }
  const sessionStore = MongoStore.create({ mongoUrl: config.MONGODB_URI, collectionName: 'sessions', ttl: 12 * 60 * 60 })
  app.locals.sessionStore = sessionStore

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint()
    res.on('finish', () => logger.info({ method: req.method, path: req.path, statusCode: res.statusCode, durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000 }, 'Solicitud HTTP'))
    next()
  })
  app.use(helmet())
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-Requested-With'] }))
  app.use(express.json({ limit: '1mb', type: 'application/json' }))

  const health = express.Router()
  health.get('/live', (_req, res) => res.json({ data: { status: 'alive' } }))
  health.get('/ready', (_req, res) => {
    const ready = databaseIsReady()
    res.status(ready ? 200 : 503).json({ data: { status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' } })
  })
  app.use('/api/v1/health', health)

  app.use(session({
    name: config.SESSION_COOKIE_NAME,
    secret: config.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production' || config.SESSION_SAME_SITE === 'none',
      sameSite: config.SESSION_SAME_SITE,
      maxAge: 12 * 60 * 60 * 1000,
    },
  }))

  const api = express.Router()
  api.use('/auth', createAuthRouter(config))
  api.use('/clients', clientRouter)
  api.use('/policies', policyRouter)
  api.use('/renewals', renewalRouter)
  api.use('/tasks', taskRouter)
  api.use('/notifications', createNotificationRouter(config))
  api.use('/telegram', createTelegramWebhookRouter(config))
  api.use('/scheduler', createSchedulerRouter(config))
  api.use('/business', businessRouter)
  api.use('/outlook', createOutlookRouter(config))
  app.use('/api/v1', api)

  app.use((_req, _res, next) => next(new AppError(404, 'not_found', 'No encontramos esa ruta.')))
  app.use(errorHandler)
  return app
}
