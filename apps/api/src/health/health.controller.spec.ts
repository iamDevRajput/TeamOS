import { describe, expect, it } from 'vitest';
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
});

