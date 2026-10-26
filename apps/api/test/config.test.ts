import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  WEB_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/crm_test',
  SESSION_SECRET: 'a-random-test-secret-with-more-than-32-characters',
  INITIAL_SETUP_KEY: '',
}

describe('configuración del backend', () => {
  it('carga la configuración tipada y mantiene cerrada el alta inicial cuando no hay clave', () => {
    const config = loadConfig(validEnvironment)

    expect(config.PORT).toBe(3001)
    expect(config.SESSION_SECRET).toBe(validEnvironment.SESSION_SECRET)
    expect(config.INITIAL_SETUP_KEY).toBeUndefined()
    expect(config.SESSION_SAME_SITE).toBe('lax')
  })

  it('rechaza secretos de sesión vacíos o demasiado cortos', () => {
    expect(() => loadConfig({ ...validEnvironment, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET debe tener al menos 32 caracteres.')
  })

  it('rechaza una URI de MongoDB ausente', () => {
    expect(() => loadConfig({ ...validEnvironment, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/)
  })

  it('exige configurar juntas las credenciales y el cifrado de Microsoft', () => {
    expect(() => loadConfig({ ...validEnvironment, MICROSOFT_CLIENT_ID: 'client-id' })).toThrow(/MICROSOFT_TOKEN_ENCRYPTION_KEY/)
    const config=loadConfig({ ...validEnvironment, MICROSOFT_CLIENT_ID:'client-id', MICROSOFT_CLIENT_SECRET:'secret', MICROSOFT_REDIRECT_URI:'https://crm.example.com/api/v1/outlook/callback', MICROSOFT_TOKEN_ENCRYPTION_KEY:'A'.repeat(43)+'=' })
    expect(config.MICROSOFT_CLIENT_ID).toBe('client-id')
  })
})
