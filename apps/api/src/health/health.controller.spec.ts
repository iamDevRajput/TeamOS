import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns status ok with ISO timestamp', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(result.environment).toBeDefined();
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns liveness probe status', () => {
    const controller = new HealthController();
    const result = controller.getLiveness();
    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns readiness probe status when database is reachable', async () => {
    const controller = new HealthController();
    vi.spyOn((controller as any).prisma, '$queryRaw').mockResolvedValue([{ 1: 1 }]);
    const result = await controller.getReadiness();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
  });
});
