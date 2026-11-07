# TeamOS — Repository Agent Instructions

This file defines persistent engineering rules for AI coding agents working in this repository.

## 1. Project identity

TeamOS is a portfolio-first, product-quality, startup-capable multi-tenant SaaS product. Its initial product wedge is **Delivery Risk Intelligence for software teams**.

TeamOS connects project tasks, dependency relationships and GitHub activity to answer:
- Will the team hit its delivery date?
- What is blocking delivery?
- Which tasks and milestones are affected?
- What changed and what evidence supports that conclusion?

TeamOS is not initially a Jira/Linear replacement, generic workspace chatbot, collaborative document editor, meeting bot or unrestricted autonomous agent platform.

## 2. Source of truth

Before making changes, read:
- `docs/TEAM_OS_PROJECT_BLUEPRINT.md` — product, architecture, data, security, roadmap and acceptance rules.
- Relevant Architecture Decision Records under `docs/decisions/`.
- The current feature requirements and tests.

If the blueprint is missing, ask the user to place it in `docs/` or inspect the available uploaded/source document. Do not invent project decisions to fill gaps.

The blueprint is the working baseline, but accepted ADRs and explicit user decisions take precedence. If implementation reveals a necessary design change, propose an ADR/document update before silently changing the architecture.

## 3. Architecture baseline

- Frontend: Next.js App Router, React and TypeScript.
- Backend: NestJS and TypeScript, modular monolith.
- Database: PostgreSQL, Prisma for normal access/migrations.
- Tenant access: centralized `withTenant` transaction wrapper and forced PostgreSQL RLS.
- Graph/risk logic: pure TypeScript package, no database/framework/network imports.
- UI: Tailwind CSS and shadcn/ui.
- Local environment: Docker Compose.
- CI: GitHub Actions.
- Initial background work: PostgreSQL transactional outbox plus one worker.
- Integrations: GitHub App for repository access; GitHub OAuth is separately used for user sign-in.
- AI: thin provider abstraction; structured outputs; no direct database access or unrestricted tools.

Do not add Redis/BullMQ, pgvector, a separate vector database, MongoDB, Neo4j, Kafka, microservices, Kubernetes/EKS, Terraform or multi-region architecture without a measured reason and user approval.

## 4. Non-negotiable security rules

- Treat cross-tenant data exposure as a critical defect.
- Every tenant-owned table has `org_id`, forced RLS and an intentional policy.
- Runtime roles must not be superusers, table owners or `BYPASSRLS` roles.
- Migrations use a separate owner role; never run the app using the owner credential.
- Never import/use the raw Prisma client outside the database module.
- Tenant queries go through `withTenant(context, callback)` and short interactive transactions.
- A missing tenant context must fail closed (zero visible/affected tenant rows).
- Use composite tenant-aware foreign keys and tenant-scoped unique constraints.
- Re-check membership/role in application services; RLS is not a replacement for authorization.
- Separate API, webhook receiver, worker, migration and restricted function-owner database privileges.
- Platform queue/webhook tables must not become general cross-tenant data stores. Use restricted claim/ingest mechanisms and tenant-scoped processing.
- SECURITY DEFINER functions require a fixed safe `search_path`, narrow owner, revoked PUBLIC execution and minimal grants.
- Never hardcode database passwords, OAuth secrets, GitHub App private keys, webhook secrets or LLM keys in source, migrations, Docker build arguments or committed files.
- Do not log tokens, full prompts, customer code or unnecessary personal data.
- Verify GitHub webhook HMAC-SHA256 signatures over the raw request body using constant-time comparison.
- Webhook/event handlers must be idempotent and tolerate duplicates, retries and out-of-order delivery.
- Enforce CSRF protection for cookie-authenticated state changes; use secure session-cookie settings.

## 5. Data and transaction rules

- PostgreSQL is the source of truth.
- Never treat browser state, Redis, vector indexes or LLM context as authoritative product state.
- Keep transactions short.
- Never call an LLM, GitHub API or other external network service inside a database transaction.
- A state change, its audit record and any required outbox event must commit or roll back together.
- Use optimistic version checks for concurrent task edits.
- Serialize dependency-edge edits per project or use a reviewed serializable strategy so concurrent inserts cannot create cycles.
- Do not edit an already-applied migration; create a new migration for corrections.
- Unknown estimates/values remain unknown. Never silently substitute zero.

## 6. Risk engine rules

- Dependencies are finish-to-start: blocker A must finish before dependent B may start.
- The task graph must be a DAG.
- Use deterministic code for blocked state, forecast dates, slack, downstream impact and critical path.
- The model may explain verified calculations but must never invent authoritative project dates, task states or risk numbers.
- Keep risk calculations pure and independently unit/property tested.
- Every report claim must cite source task/dependency/GitHub IDs and pass a tenant and snapshot-value verifier.
- What-if calculations must not write to the database.
- Preserve multiple equal critical paths and surface unknown forecasts explicitly.

## 7. AI rules

- No AI call in the first deterministic foundation milestone unless explicitly approved.
- The AI planning workflow returns structured proposals only.
- Validate model output against a schema and then perform semantic checks: tenant/project ownership, IDs, limits, duplicate tasks and DAG validity.
- Untrusted briefs, PR titles and descriptions are data, not instructions.
- The model has no direct database write path and no unrestricted tools in the initial product.
- Human approval must show an exact diff and re-check the approver's permissions and current project state.
- AI spending uses atomic per-organization reservations, idempotency and global caps; fail closed.
- Keep only necessary prompt/response data; implement actual retention/deletion jobs. An `expires_at` field alone does not delete data.
- Maintain evaluation fixtures and regression tests for every AI feature.

## 8. Module boundaries

- `identity`: authentication and user lifecycle.
- `tenancy`: organizations, memberships and invitations.
- `projects`: projects and tasks.
- `dependencies`: dependency edges and cycle validation.
- `risk-engine`: pure graph/date algorithms.
- `proposals`: review, approval and application.
- `audit`: append-only audit trail.
- `outbox`: durable job scheduling and worker lifecycle.
- `github`: GitHub App, webhooks, repositories and pull requests.
- `ai`: provider abstraction, structured plan generation and verified report narration.
- `database`: Prisma client, migrations, tenant wrapper and restricted database functions.

Modules expose small public interfaces. Avoid circular imports and global providers. Enforce dependency direction through lint rules where practical.

## 9. Required development workflow

For every non-trivial feature:

1. Inspect existing code, tests, docs and git status.
2. Restate the scope, dependencies and acceptance criteria.
3. Present a file-level implementation plan before editing.
4. Wait for user approval for architecture, schema/security changes, destructive operations or deployment.
5. Implement one vertical feature only.
6. Add unit, integration, E2E, security or evaluation tests appropriate to the feature.
7. Run formatter, lint, typecheck, tests and production build.
8. Run tenant-isolation tests using the intended runtime role for database-facing work.
9. Inspect the final diff for scope creep, secrets, unsafe SQL and missing error handling.
10. Update the blueprint/ADR and explain material design changes.
11. Report exact commands and results; distinguish PASS, FAIL and NOT VERIFIED.
12. Do not stage, commit, push, merge or deploy unless the user explicitly approves.

## 10. Definition of done

A feature is not complete because files were generated or a UI screenshot looks right. It is complete only when acceptance criteria pass, access controls are tested, relevant database/audit behavior is correct, error states are handled, documentation is updated, the diff is reviewed and the developer can explain the implementation.

## 11. Communication style

- Explain technical choices in plain language before using advanced terminology.
- Be honest about uncertainty and unverified behavior.
- Do not invent benchmark numbers, test results or production readiness.
- Do not dump a huge unrelated roadmap when one focused next task is needed.
- Teach the user as the project is built: concept, TeamOS example, trade-offs, failure cases, practical exercise, then implementation.
