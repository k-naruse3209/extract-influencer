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

  const port = process.env.PORT ?? '3001'
  await app.listen(port, '0.0.0.0')
  structuredLogger.log(`Application listening on port ${port}`, 'Bootstrap')
}

void bootstrap()
