import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors.js'
import { logger } from '../logger.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const appError = error instanceof AppError ? error : undefined
  const bodyError = getBodyParserError(error)
  const statusCode = appError?.statusCode ?? bodyError?.statusCode ?? 500
  if (statusCode >= 500) logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError', method: req.method, path: req.path }, 'Error al procesar la solicitud')
  res.status(statusCode).json({ error: { code: appError?.code ?? bodyError?.code ?? 'internal_error', message: appError?.message ?? bodyError?.message ?? 'Ocurrió un error interno.' } })
}

function getBodyParserError(error: unknown): { statusCode: number; code: string; message: string } | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined
  if (error.type === 'entity.parse.failed') return { statusCode: 400, code: 'invalid_json', message: 'El cuerpo JSON no tiene un formato válido.' }
  if (error.type === 'entity.too.large') return { statusCode: 413, code: 'payload_too_large', message: 'El cuerpo de la solicitud supera el tamaño permitido.' }
  return undefined
}
