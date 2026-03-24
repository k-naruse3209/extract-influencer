import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StructuredLogger } from './structured-logger'

describe('StructuredLogger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env['NODE_ENV']
  })

  describe('in production mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production'
    })

    it('writes a JSON line for log()', () => {
      const logger = new StructuredLogger()
      logger.log('hello world', 'TestContext')

      expect(stdoutSpy).toHaveBeenCalledOnce()
      const raw = String(stdoutSpy.mock.calls[0]?.[0])
      const parsed = JSON.parse(raw.trim()) as Record<string, unknown>

      expect(parsed['level']).toBe('info')
      expect(parsed['message']).toBe('hello world')
      expect(parsed['context']).toBe('TestContext')
      expect(typeof parsed['timestamp']).toBe('string')
    })

    it('writes a JSON line for error() including trace', () => {
      const logger = new StructuredLogger()
      logger.error('something failed', 'Error: stack trace', 'ErrorCtx')

      const raw = String(stdoutSpy.mock.calls[0]?.[0])
      const parsed = JSON.parse(raw.trim()) as Record<string, unknown>

      expect(parsed['level']).toBe('error')
      expect(parsed['trace']).toBe('Error: stack trace')
    })

    it('writes a JSON line for warn()', () => {
      const logger = new StructuredLogger()
      logger.warn('be careful', 'WarnCtx')

      const raw = String(stdoutSpy.mock.calls[0]?.[0])
      const parsed = JSON.parse(raw.trim()) as Record<string, unknown>

      expect(parsed['level']).toBe('warn')
    })

    it('masks password field when it appears as a top-level JSON key in the log entry', () => {
      const logger = new StructuredLogger()
      // Simulate a case where a bad caller passes password in the extra payload.
      // StructuredLogger.writeLog merges extra into the JSON entry directly.
      // We test via error() which accepts an extra `trace` field — to exercise the
      // sanitize path for other sensitive keys we call writeLog via log() and verify
      // the sanitize regex on the final JSON string.
      //
      // The sanitize regex matches "password":"<value>" in the serialized JSON.
      // Passing it inside message just embeds it as a string value (double-escaped),
      // so it won't match. Instead we verify sanitize directly via a crafted JSON.
      const rawJson = '{"timestamp":"t","level":"info","context":"c","message":"ok","password":"secret123"}'
      // @ts-expect-error — accessing private method for unit test
      const sanitized: string = (logger as unknown as { sanitize(s: string): string }).sanitize(rawJson)

      expect(sanitized).not.toContain('secret123')
      expect(sanitized).toContain('"password":"***"')
    })

    it('masks token field via sanitize()', () => {
      const logger = new StructuredLogger()
      const rawJson = '{"token":"bearer-abc","level":"info"}'
      // @ts-expect-error — accessing private method for unit test
      const sanitized: string = (logger as unknown as { sanitize(s: string): string }).sanitize(rawJson)

      expect(sanitized).not.toContain('bearer-abc')
      expect(sanitized).toContain('"token":"***"')
    })

    it('masks apiKey field via sanitize()', () => {
      const logger = new StructuredLogger()
      const rawJson = '{"apiKey":"sk-12345","level":"info"}'
      // @ts-expect-error — accessing private method for unit test
      const sanitized: string = (logger as unknown as { sanitize(s: string): string }).sanitize(rawJson)

      expect(sanitized).not.toContain('sk-12345')
      expect(sanitized).toContain('"apiKey":"***"')
    })

    it('masks encryptedToken field via sanitize()', () => {
      const logger = new StructuredLogger()
      const rawJson = '{"encryptedToken":"aes-data","level":"info"}'
      // @ts-expect-error — accessing private method for unit test
      const sanitized: string = (logger as unknown as { sanitize(s: string): string }).sanitize(rawJson)

      expect(sanitized).not.toContain('aes-data')
      expect(sanitized).toContain('"encryptedToken":"***"')
    })

    it('defaults context to "Application" when not provided', () => {
      const logger = new StructuredLogger()
      logger.log('no context')

      const raw = String(stdoutSpy.mock.calls[0]?.[0])
      const parsed = JSON.parse(raw.trim()) as Record<string, unknown>
      expect(parsed['context']).toBe('Application')
    })

    it('setLogLevels does not throw', () => {
      const logger = new StructuredLogger()
      expect(() => logger.setLogLevels(['error', 'warn'])).not.toThrow()
    })
  })

  describe('in development mode', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development'
    })

    it('writes plain text (not JSON) for log()', () => {
      const logger = new StructuredLogger()
      logger.log('plain output', 'DevCtx')

      expect(stdoutSpy).toHaveBeenCalledOnce()
      const raw = String(stdoutSpy.mock.calls[0]?.[0])

      // Should not be valid JSON
      expect(() => JSON.parse(raw.trim())).toThrow()
      expect(raw).toContain('plain output')
      expect(raw).toContain('[DevCtx]')
    })

    it('includes trace in error() output', () => {
      const logger = new StructuredLogger()
      logger.error('dev error', 'stack here', 'ErrCtx')

      const raw = String(stdoutSpy.mock.calls[0]?.[0])
      expect(raw).toContain('stack here')
    })
  })
})
