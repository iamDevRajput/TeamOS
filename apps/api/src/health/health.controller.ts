import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@teamos/contracts';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

