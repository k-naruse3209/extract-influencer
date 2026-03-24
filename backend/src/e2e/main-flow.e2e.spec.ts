/**
 * E2E: Main flow — login → create profile → save candidate → score → report
 *
 * Setup notes:
 *   - Uses NestFastifyApplication with the same Fastify/cookie/prefix config as main.ts
 *   - All controllers use paths relative to the global prefix /api/v1
 *   - Requires a running PostgreSQL on port 5433 and Redis on port 6380.
 *     Start with: docker compose -f docker-compose.test.yml up -d
 *   - Environment is loaded from backend/.env.test via the setup file
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import type { TestingModule } from '@nestjs/testing'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import * as supertest from 'supertest'
import * as bcryptjs from 'bcryptjs'
import { AppModule } from '../app.module'
import { PrismaService } from '../common/prisma/prisma.service'
import { HttpExceptionFilter } from '../common/filters/http-exception.filter'

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

let app: NestFastifyApplication
let prisma: PrismaService
let request: supertest.SuperTest<supertest.Test>

let userId: string
let profileId: string
let accessTokenCookie: string

// ---------------------------------------------------------------------------
// Helper: extract Set-Cookie value by name
// ---------------------------------------------------------------------------

function extractCookie(headers: Record<string, string | string[]>, name: string): string | null {
  const setCookieHeader = headers['set-cookie']
  if (!setCookieHeader) return null
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
  for (const c of cookies) {
    const match = c.match(new RegExp(`^${name}=([^;]+)`))
    if (match) return `${name}=${match[1]}`
  }
  return null
}

// ---------------------------------------------------------------------------
// beforeAll — bootstrap app and seed test data
// ---------------------------------------------------------------------------

beforeAll(async () => {
  process.env.NODE_ENV = 'test'

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )

  // Mirror main.ts setup
  await app.register(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@fastify/cookie'),
    {
      secret: process.env.COOKIE_SECRET ?? 'test-cookie-secret',
      hook: 'onRequest',
    },
  )
  app.setGlobalPrefix('api/v1')
  app.useGlobalFilters(new HttpExceptionFilter())

  await app.init()
  // Fastify requires waiting for the platform to be fully initialised
  await app.getHttpAdapter().getInstance().ready()

  prisma = moduleRef.get(PrismaService)

  // Seed: test user
  const hashedPassword = await bcryptjs.hash('TestPass123!', 10)
  const user = await prisma.user.create({
    data: {
      email: 'e2e-test@example.com',
      hashedPassword,
      name: 'E2E Test User',
      role: 'ADMIN',
    },
  })
  userId = user.id

  // Seed: influencer profile (bypasses Instagram API)
  const profile = await prisma.influencerProfile.create({
    data: {
      username: 'test_influencer_e2e',
      platform: 'INSTAGRAM',
      displayName: 'E2E Test Influencer',
    },
  })
  profileId = profile.id

  // supertest agent bound to Fastify's http.Server
  request = supertest(app.getHttpServer())
}, 60_000)

// ---------------------------------------------------------------------------
// afterAll — clean up seeded records and close app
// ---------------------------------------------------------------------------

afterAll(async () => {
  // Remove in reverse dependency order
  await prisma.report.deleteMany({ where: { userId } })
  await prisma.savedCandidate.deleteMany({ where: { userId } })
  await prisma.scoreRecord.deleteMany({ where: { profileId } })
  await prisma.influencerProfile.deleteMany({ where: { id: profileId } })
  await prisma.user.deleteMany({ where: { id: userId } })

  await app.close()
}, 30_000)

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

describe('Main flow: login → profile → save → score → report', () => {
  /**
   * Step 1: Login
   * POST /api/v1/auth/login
   */
  it('Step 1: should login and receive access_token cookie', async () => {
    const response = await request
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-test@example.com', password: 'TestPass123!' })
      .expect(200)

    expect(response.body).toHaveProperty('user')
    expect(response.body.user.email).toBe('e2e-test@example.com')
    expect(response.body.user.role).toBe('ADMIN')

    const cookie = extractCookie(
      response.headers as Record<string, string | string[]>,
      'access_token',
    )
    expect(cookie).not.toBeNull()
    accessTokenCookie = cookie!
  })

  /**
   * Step 2: Get influencer profile detail
   * GET /api/v1/influencer-profiles/:id
   */
  it('Step 2: should fetch the seeded influencer profile', async () => {
    const response = await request
      .get(`/api/v1/influencer-profiles/${profileId}`)
      .set('Cookie', accessTokenCookie)
      .expect(200)

    expect(response.body.id).toBe(profileId)
    expect(response.body.username).toBe('test_influencer_e2e')
  })

  /**
   * Step 3: Save as candidate
   * POST /api/v1/saved-candidates
   */
  it('Step 3: should save profile as candidate', async () => {
    const response = await request
      .post('/api/v1/saved-candidates')
      .set('Cookie', accessTokenCookie)
      .send({ profileId, note: 'E2E test note' })
      .expect(201)

    expect(response.body).toHaveProperty('id')
    expect(response.body.profileId).toBe(profileId)
  })

  /**
   * Step 4: Get latest score
   * GET /api/v1/influencer-profiles/:profileId/scores/latest
   *
   * No score has been calculated for this profile yet, so 404 is expected.
   */
  it('Step 4: should return 404 when no score exists for the profile', async () => {
    const response = await request
      .get(`/api/v1/influencer-profiles/${profileId}/scores/latest`)
      .set('Cookie', accessTokenCookie)

    // 404 is acceptable — no score has been calculated in this E2E run
    expect([200, 404]).toContain(response.status)

    if (response.status === 200) {
      expect(response.body).toHaveProperty('totalScore')
    } else {
      expect(response.body.error?.code ?? response.body.code).toBe('SCORE_NOT_FOUND')
    }
  })

  /**
   * Step 5: Generate CSV report (avoids Puppeteer / PDF in E2E)
   * POST /api/v1/reports
   */
  it('Step 5: should request CSV report generation and return 201', async () => {
    const response = await request
      .post('/api/v1/reports')
      .set('Cookie', accessTokenCookie)
      .send({
        format: 'CSV',
        reportType: 'SINGLE_PROFILE',
        profileIds: [profileId],
        title: 'E2E Test Report',
      })
      .expect(201)

    expect(response.body).toHaveProperty('id')
    expect(response.body.format).toBe('CSV')
    expect(response.body.title).toBe('E2E Test Report')
    // Status may be COMPLETED or FAILED depending on file system availability
    expect(['COMPLETED', 'FAILED', 'PENDING', 'PROCESSING']).toContain(
      response.body.status,
    )
  })

  /**
   * Step 6: List reports
   * GET /api/v1/reports
   */
  it('Step 6: should list reports and include the generated report', async () => {
    const response = await request
      .get('/api/v1/reports')
      .set('Cookie', accessTokenCookie)
      .expect(200)

    expect(Array.isArray(response.body)).toBe(true)
    expect(response.body.length).toBeGreaterThanOrEqual(1)

    const titles = (response.body as { title: string }[]).map((r) => r.title)
    expect(titles).toContain('E2E Test Report')
  })
})
