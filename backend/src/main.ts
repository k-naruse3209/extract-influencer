import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { StructuredLogger } from './common/logger/structured-logger'

async function bootstrap(): Promise<void> {
  const structuredLogger = new StructuredLogger()

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { logger: structuredLogger },
  )

  // Register @fastify/cookie for httpOnly cookie support
  await app.register(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@fastify/cookie'),
    {
      secret: process.env.COOKIE_SECRET ?? 'default-cookie-secret',
      hook: 'onRequest',
    },
  )

  // Global prefix
  app.setGlobalPrefix('api/v1')

  // Global exception filter for unified error response format
  app.useGlobalFilters(new HttpExceptionFilter())

  // Swagger UI — development only
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Influencer Discovery & Deep Analysis Platform API')
      .setDescription(
        'API for discovering, scoring and reporting on influencer candidates',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build()

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    structuredLogger.log('Swagger UI available at /api/docs', 'Bootstrap')
  }

  // CORS — tighten origins in production via env
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })

  // Raw body capture for Meta Webhook X-Hub-Signature-256 verification.
  // Fastify does not preserve rawBody by default; override JSON parser to store original string.
  const fastifyInstance = app.getHttpAdapter().getInstance()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fastifyInstance.addContentTypeParser('application/json', { parseAs: 'string' }, (req: any, body: string, done: (err: Error | null, payload?: unknown) => void) => {
    req.rawBody = body
    try {
      done(null, JSON.parse(body))
    } catch (err) {
      done(err as Error)
    }
  })

  // Static pages — served directly (no /api/v1 prefix) for Meta App Review

  fastifyInstance.get('/terms', async (_request: unknown, reply: { type: (t: string) => { send: (html: string) => void } }) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Terms of Service - Influencer Discovery Platform</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;padding:2rem 1rem;color:#333;line-height:1.6}h1{font-size:1.8rem}h2{font-size:1.2rem;margin-top:1.5rem}ul{padding-left:1.5rem}</style></head>
<body>
<h1>Terms of Service</h1>
<p><small>Last updated: April 9, 2026</small></p>

<h2>1. Agreement to Terms</h2>
<p>By accessing or using the Influencer Discovery Platform (the "Service") operated by DXAI Solutions, Inc. ("Company", "we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree to these Terms, please do not use the Service.</p>

<h2>2. Description of Service</h2>
<p>The Service provides tools for discovering, analyzing, and comparing Instagram influencer accounts. Features include profile data retrieval via the Instagram API with Instagram Login, scoring and analysis, candidate comparison, and report generation (PDF/CSV).</p>

<h2>3. Eligibility</h2>
<p>You must be at least 18 years of age and have the legal capacity to enter into a binding agreement to use this Service.</p>

<h2>4. Account Registration</h2>
<p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

<h2>5. Instagram Integration</h2>
<p>The Service integrates with Instagram via the Instagram API with Instagram Login. By connecting your Instagram account, you agree to grant the Service permission to access your connected Instagram Business or Creator account and to comply with Meta's Platform Terms.</p>

<h2>6. Acceptable Use</h2>
<p>You agree not to use the Service to violate any applicable laws, infringe intellectual property rights, harass any individual, collect data for malicious purposes, or violate Meta Platform Policies.</p>

<h2>7. Intellectual Property</h2>
<p>The Service and its original content are the exclusive property of DXAI Solutions, Inc. and its licensors.</p>

<h2>8. Disclaimer of Warranties</h2>
<p>The Service is provided on an "AS IS" basis without any warranties of any kind. Influencer analysis results are estimates and should not be relied upon as the sole basis for business decisions.</p>

<h2>9. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, DXAI Solutions, Inc. shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service.</p>

<h2>10. Termination</h2>
<p>We reserve the right to terminate or suspend your account at any time for conduct that violates these Terms.</p>

<h2>11. Governing Law</h2>
<p>These Terms shall be governed by the laws of Japan.</p>

<h2>12. Contact Us</h2>
<p><strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)<br/>Email: legal@dxai-solutions.co.jp</p>
</body>
</html>`)
  })

  fastifyInstance.get('/data-deletion', async (_request: unknown, reply: { type: (t: string) => { send: (html: string) => void } }) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Data Deletion Instructions - Influencer Discovery Platform</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;padding:2rem 1rem;color:#333;line-height:1.6}h1{font-size:1.8rem}h2{font-size:1.2rem;margin-top:1.5rem}ol{padding-left:1.5rem}</style></head>
<body>
<h1>Data Deletion Instructions</h1>
<p><small>Last updated: April 9, 2026</small></p>

<p>This page explains how to request deletion of your data that DXAI Solutions, Inc. has collected through the Influencer Discovery Platform via Instagram Login.</p>

<h2>What Data We Store</h2>
<p>When you connect your Instagram account to our Service, we store:</p>
<ul>
<li>Your Instagram access token (encrypted with AES-256-GCM)</li>
<li>Your connected Instagram account ID and username</li>
<li>Instagram profile data retrieved via the Instagram API with Instagram Login</li>
</ul>

<h2>How to Delete Your Data</h2>

<h3>Option 1: Disconnect via the Service</h3>
<ol>
<li>Log in to the Influencer Discovery Platform</li>
<li>Navigate to <strong>Settings &gt; Instagram Integration</strong></li>
<li>Click <strong>Disconnect</strong></li>
<li>This will immediately delete your stored access tokens</li>
</ol>

<h3>Option 2: Revoke via Meta</h3>
<ol>
<li>Go to your <a href="https://www.facebook.com/settings?tab=applications">Meta Settings &gt; Apps and Websites</a></li>
<li>Find <strong>Influencer Discovery Platform</strong> and click <strong>Remove</strong></li>
<li>This revokes all permissions granted to our app</li>
</ol>

<h3>Option 3: Request Full Data Deletion</h3>
<p>To request complete deletion of all your data (including analysis results and saved candidates), contact us:</p>
<p><strong>Email:</strong> privacy@dxai-solutions.co.jp<br/>
Subject: "Data Deletion Request"<br/>
Include your registered email address in the request.</p>
<p>We will process your request within 30 days and confirm deletion by email.</p>

<h2>Contact</h2>
<p><strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)<br/>Email: privacy@dxai-solutions.co.jp</p>
</body>
</html>`)
  })

  fastifyInstance.get('/privacy-policy', async (_request: unknown, reply: { type: (t: string) => { send: (html: string) => void } }) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Privacy Policy - Influencer Discovery Platform</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;padding:2rem 1rem;color:#333;line-height:1.6}h1{font-size:1.8rem}h2{font-size:1.2rem;margin-top:1.5rem}ul{padding-left:1.5rem}</style></head>
<body>
<h1>Privacy Policy</h1>
<p><small>Last updated: April 9, 2026</small></p>

<h2>1. Introduction</h2>
<p>DXAI Solutions, Inc. ("Company", "we", "us", or "our") operates the Influencer Discovery Platform (the "Service"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>

<h2>2. Information We Collect</h2>
<h3>2.1 Information from Instagram</h3>
<p>When you connect your Instagram account through Instagram Login, we access the following data with your explicit consent:</p>
<ul>
<li><strong>instagram_business_basic</strong>: Basic profile information of your connected Instagram Business or Creator account.</li>
<li><strong>instagram_business_manage_insights</strong>: Media insights for your connected account, where available.</li>
</ul>

<h3>2.2 Target Profile Discovery Data</h3>
<p>We use official Instagram API target profile discovery endpoints to retrieve supported profile information of Instagram Business and Creator accounts for analysis purposes. When the target profile is not the connected account, unsupported media-level metrics and insights remain unavailable and are not backfilled from another account.</p>

<h3>2.3 Account Information</h3>
<p>When you create an account, we collect your email address and display name for authentication and communication purposes.</p>

<h2>3. How We Use Your Information</h2>
<ul>
<li>To provide influencer discovery and analysis functionality</li>
<li>To calculate brand-fit scores, engagement metrics, and risk assessments</li>
<li>To generate comparison reports (PDF/CSV) for your use</li>
<li>To maintain and improve the Service</li>
<li>To authenticate your identity and manage your account</li>
</ul>

<h2>4. Data Storage and Security</h2>
<p>Access tokens obtained through Instagram Login are encrypted using AES-256-GCM before storage. We do not store plaintext tokens. All data is transmitted over HTTPS. We implement role-based access control (RBAC).</p>

<h2>5. Data Sharing</h2>
<p>We do not sell, trade, or rent your personal information to third parties. We do not share your Instagram account data with any third party.</p>

<h2>6. Data Retention and Deletion</h2>
<p>You may disconnect your Instagram account at any time through the Settings page. You may request deletion of all your data by contacting us. Upon account deletion, all associated data will be permanently removed.</p>

<h2>7. Your Rights</h2>
<ul>
<li>Access the personal data we hold about you</li>
<li>Request correction of inaccurate data</li>
<li>Request deletion of your data</li>
<li>Withdraw consent for data processing at any time</li>
<li>Revoke Instagram permissions through Meta account settings</li>
</ul>

<h2>8. Cookies</h2>
<p>We use essential cookies for authentication (session management via httpOnly secure cookies). We do not use advertising or tracking cookies.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last updated" date.</p>

<h2>10. Contact Us</h2>
<p><strong>DXAI Solutions, Inc.</strong> (株式会社DXAIソリューションズ)<br/>Email: privacy@dxai-solutions.co.jp</p>
</body>
</html>`)
  })

  const port = process.env.PORT ?? '3001'
  await app.listen(port, '0.0.0.0')
  structuredLogger.log(`Application listening on port ${port}`, 'Bootstrap')
}

void bootstrap()
