import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
    organizationId?: string
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        organizationId: string
        role: 'owner'
      }
    }
  }
}

export {}
