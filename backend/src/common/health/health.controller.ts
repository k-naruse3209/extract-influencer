import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'

interface HealthResponse {
  status: 'ok'
  timestamp: string
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * Liveness probe endpoint.
   * Authentication is intentionally not required so that
   * load balancers and orchestrators can call this freely.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}
