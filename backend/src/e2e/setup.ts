/**
 * E2E global setup: load .env.test before any test module is bootstrapped.
 *
 * NestJS ConfigModule.forRoot uses envFilePath: ['.env.local', '.env'] by
 * default and does not pick up .env.test automatically. We pre-populate
 * process.env here so that ConfigService returns the correct test values.
 *
 * Uses Node.js built-ins only (no dotenv dependency required at this layer)
 * because dotenv is available via the monorepo root node_modules.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envFilePath = resolve(__dirname, '../../.env.test')

try {
  const content = readFileSync(envFilePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    // Only set if not already defined (allow CI overrides)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
} catch {
  // .env.test may not exist in CI — rely on environment variables being set externally
  console.warn('[e2e/setup] .env.test not found — using existing process.env values')
}
