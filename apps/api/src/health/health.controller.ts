import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse } from '@teamos/contracts';
import { createApiPrismaClient } from '@teamos/database';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();
  private readonly prisma = createApiPrismaClient();

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('live')
  getLiveness(): { status: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('ready')
  async getReadiness(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException('Database connectivity check failed.');
    }
  }
}
