import { describe, it, expect, beforeEach } from 'vitest';
import { AiService } from '../ai.service';
import { MockLlmProvider } from '../providers/mock-llm.provider';
import { GeminiLlmProvider } from '../providers/gemini-llm.provider';
import { validateAndSortGraph } from '@teamos/risk-engine';

const EVAL_BRIEFS = [
  'Multi-factor Authentication & WebAuthn support with passkeys and backup codes',
  'Stripe Billing & Subscription Invoicing with webhook receipt handling',
  'PostgreSQL Read Replicas & Connection Pooling setup with pgbouncer',
  'GitHub Webhook Receiver & Outbox Delivery with constant-time HMAC verification',
  'Realtime WebSocket Notifications Service with Redis PubSub adapter',
  'S3 and Cloud Storage File Upload with malware scanning and CDN links',
  'OAuth2 Provider and Social Logins for Google, GitHub, and Apple',
  'Role-Based Access Control (RBAC) with fine-grained permissions and audit logging',
  'Mobile Push Notifications via FCM and APNs with token lifecycle management',
  'Full-Text Search engine integration with indexing and fuzzy matching',
  'Customer Data Export Pipeline supporting CSV, PDF, and JSON formats',
  'Multi-Region Database Disaster Recovery with automated replication and failover',
  'GDPR Compliance module with right-to-be-forgotten deletion workflows',
  'End-to-End Encryption service for tenant secrets using envelope encryption',
  'Distributed Rate Limiting and Bot Protection shield using token bucket algorithm',
  'Automated Canary Deployments with health metric validation and rollback',
  'Enterprise Single Sign-On (SSO) via SAML 2.0 and OIDC for Okta and Azure AD',
  'In-app Customer Support Widget with messaging, presence, and assignment',
  'Telemetry and Distributed Tracing instrumentation with OpenTelemetry and Jaeger',
  'Zero-downtime Database Migration harness with rollback verification',
  'Feature Flagging and Experimentation engine with user percentage rollouts',
  'Design System component library with dark mode and WCAG AA accessibility',
  'AI Brief-to-Plan Generator with semantic validation and DAG verification',
  'Transactional Email Service with DKIM, SPF, delivery tracking, and templates',
  'Continuous Security Vulnerability Scanner for open-source dependencies and containers',
];

describe('AI Planning Engine 25-Case Evaluation Suite (Phase G)', () => {
  let provider: MockLlmProvider;

  beforeEach(() => {
    provider = new MockLlmProvider();
  });

  EVAL_BRIEFS.forEach((brief, index) => {
    it(`Case ${index + 1}/25: Produces valid, bounded, acyclic DAG plan for: "${brief.slice(0, 40)}..."`, async () => {
      const response = await provider.generatePlan({
        brief,
        projectContext: { name: 'Core SaaS', key: 'SAAS' },
      });

      // 1. Plan structure assertions
      expect(response.title).toBeDefined();
      expect(response.title.length).toBeGreaterThan(5);
      expect(response.description).toBeDefined();
      expect(response.tasks.length).toBeGreaterThanOrEqual(3);
      expect(response.tasks.length).toBeLessThanOrEqual(30);

      // 2. Task estimates validation
      const taskIds = new Set<string>();
      for (const task of response.tasks) {
        expect(task.tempId).toBeDefined();
        expect(task.title.length).toBeGreaterThan(3);
        expect(task.remainingEstimateWorkdays).toBeGreaterThan(0);
        expect(task.remainingEstimateWorkdays).toBeLessThanOrEqual(30);
        expect(Number.isInteger(task.remainingEstimateWorkdays)).toBe(true);
        taskIds.add(task.tempId);
      }

      // 3. Dependency structure validation
      for (const dep of response.dependencies) {
        expect(taskIds.has(dep.blockerTempId)).toBe(true);
        expect(taskIds.has(dep.dependentTempId)).toBe(true);
        expect(dep.blockerTempId).not.toBe(dep.dependentTempId); // No self-loops
      }

      // 4. Mathematical acyclicity verification (Kahn's DAG algorithm)
      const graphValidation = validateAndSortGraph(
        Array.from(taskIds),
        response.dependencies.map((d) => ({
          blockerTaskId: d.blockerTempId,
          blockedTaskId: d.dependentTempId,
        })),
      );

      expect(graphValidation.isAcyclic).toBe(true);
      expect(graphValidation.hasCycle).toBe(false);
      expect(graphValidation.cycleNodes).toBeUndefined();
      expect(graphValidation.topologicalOrder.length).toBe(taskIds.size);
    });
  });
});

