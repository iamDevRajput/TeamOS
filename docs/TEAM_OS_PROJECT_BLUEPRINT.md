**Version:** 1.0  
**Document date:** 7 November 2026  
**Status:** Proposed engineering baseline — review before implementation  
**Product direction:** Portfolio-first, product-quality, startup-capable  
**Primary wedge:** Delivery Risk Intelligence for software teams

> **Purpose.** This is the single working reference for what TeamOS is, who it serves, what we are building first, how it should be engineered, how it will be tested, and how Claude and Antigravity should be used. It combines the product concept and Claude's Stage 1/Stage 2 work with explicit corrections and recommendations. It is not proof that any code, migration, integration, security control, or performance target has been implemented.

---

## Document map

1. Executive summary
2. Product definition and positioning
3. Users, problems and outcomes
4. Product workflow and demo scenario
5. Scope: first 30 days, MVP and later releases
6. Functional requirements and roles
7. Technology stack and technology policy
8. System architecture
9. Repository and module structure
10. Data model and database design
11. Multi-tenancy and security architecture
12. Event processing and background work
13. Deterministic delivery-risk engine
14. AI architecture and evaluation
15. GitHub integration
16. API and frontend design
17. Testing and quality strategy
18. Deployment, operations and observability
19. Roadmap and acceptance gates
20. Learning plan for the developer
21. Risks, assumptions and open decisions
22. Definition of done
23. Official technical references

---

# 1. Executive summary

TeamOS is a multi-tenant SaaS product for small software engineering teams. Its initial purpose is to answer one operational question:

**“Will we hit our delivery date, what is blocking it, and what changed?”**

The first product wedge is **delivery-risk intelligence grounded in project tasks, dependency relationships and GitHub activity**. TeamOS will not try to replace Jira, Linear, Notion, Slack or every other work tool. It will provide a minimal task foundation and connect enough real project evidence to calculate delivery risk and explain it clearly.

The product combines four capabilities:

1. **A small work-management core:** organizations, projects, tasks, estimates, due dates and dependencies.
2. **A deterministic risk engine:** computes blocked work, forecast finish dates, slack, downstream impact and critical paths using explicit rules.
3. **Evidence-backed intelligence:** shows the specific tasks, dependencies and pull requests supporting a risk statement.
4. **Controlled AI assistance:** proposes plans and later narrates verified project facts. A human reviews changes before they are applied.

The first 30-day implementation slice is deliberately not an AI-first product. It builds identity, tenancy, the project/task graph, risk calculations, a what-if preview, audit history and a manual proposal/approval flow. AI planning follows after the deterministic core is trusted; GitHub App integration follows that; evidence-backed reporting comes after both.

### Product principles

- Truth before intelligence: project state comes from stored records and deterministic calculations.
- Evidence before prose: every risk claim must point to source records.
- Least privilege: users, API processes, webhook receivers and workers receive only the permissions they require.
- Tenant isolation everywhere: database, APIs, background jobs, integrations, logs and AI context.
- Human control: AI proposes; authorized application code executes after approval.
- Small vertical slices: complete, tested features beat large incomplete code-generation sessions.
- Scale when measured: no microservices, Kubernetes, Kafka, vector database or multi-region architecture without a demonstrated need.

## 1.1 What TeamOS is not

TeamOS v1 is not a Jira replacement, general-purpose team chat, document editor, meeting bot, autonomous employee, generic chatbot over all company data, or enterprise workflow suite. Those ideas may be revisited only after customer evidence supports them.

---

# 2. Product definition and positioning

## 2.1 Working product statement

**TeamOS is delivery-risk intelligence for software teams. It connects project tasks, dependencies and GitHub activity to show what is slipping, why it is slipping, which work is affected, and what the team should review next.**

## 2.2 Target customer hypothesis

Initial persona (not yet validated): a technical lead or engineering manager in a software team of approximately 5–25 people, using GitHub, with limited dedicated project-management support. They assemble status manually from tasks, pull requests and team updates. Dependencies often live in people's heads, and delivery risks are discovered late.

This is a hypothesis. Validate it through at least five short interviews with team leads before treating it as a proven market need. Ask about their current status process, tools, missed commitments, source-of-truth problems, and whether a risk report would change an actual decision.

## 2.3 Jobs to be done

- “Show me what is blocked and why.”
- “Tell me which downstream work changes when this task slips.”
- “Show me the work threatening the project date.”
- “Connect a stalled pull request to the task and milestone it affects.”
- “Prepare a weekly status report with evidence I can verify.”
- “Turn a rough launch brief into an editable plan I can approve.”

## 2.4 Differentiation hypothesis

The differentiator is not having a chatbot. It is maintaining a reliable relationship between work items, dependencies, code activity and delivery outcomes. The system should produce reproducible calculations and source-linked explanations. This is a hypothesis to validate against customer workflows and competitors—not a claim that competitors lack these capabilities.

## 2.5 Product success signals

Early product signals:

- A team lead can create a project and maintain its dependencies without a training session.
- A changed task estimate produces the expected downstream forecast change.
- A lead can identify a blocker and trace the evidence behind it.
- A connected pull request is linked to the correct task and shown as current evidence.
- A weekly report saves real preparation time and is trusted enough to be used.
- Pilot users return to TeamOS for a real project, not only a demo.

---

# 3. Users, roles and permissions

## 3.1 Initial roles

| Role | Intended capabilities | Restrictions |
|---|---|---|
| Owner | Manage organization, members, roles, project settings, integrations and AI budget | Cannot bypass platform security controls |
| Admin | Manage projects, invite members, configure allowed integrations and project settings | Cannot transfer ownership or change owner-only controls unless explicitly granted |
| Member | View permitted projects, create/update tasks, manage dependencies and submit proposals | Cannot manage organization security, roles or billing |

This is a deliberately small role set. Do not introduce custom roles or full ABAC in the first release.

## 3.2 Authorization model

Use both:

- **Authentication (AuthN):** establish who the user is.
- **Authorization (AuthZ):** check whether that user can perform the requested action on the requested organization/project/task.

A valid session does not imply access to every organization. For tenant routes, resolve the organization from the route, load membership, verify role and then run a tenant-scoped database transaction. Never trust an `orgId` supplied only in a request body. Return a non-revealing not-found response for records outside the caller's tenant where appropriate.

## 3.3 Permission matrix (initial proposal)

| Action | Owner | Admin | Member |
|---|---:|---:|---:|
| Read organization workspace | Yes | Yes | Yes, while a member |
| Rename organization | Yes | Yes | No |
| Invite members | Yes | Yes | No |
| Change owner / delete organization | Yes | No | No |
| Create/edit projects | Yes | Yes | Yes, subject to project membership policy |
| Create/edit tasks | Yes | Yes | Yes, subject to project access |
| Add/remove dependencies | Yes | Yes | Yes, subject to project access |
| Configure GitHub installation | Yes | Yes | No |
| Change AI budget | Yes | No or owner-only initially | No |
| Approve a proposed plan | Yes | Yes | Only if the proposal's policy permits; default no for organization-wide/admin changes |

The exact permission matrix must be encoded in service-level tests before the first release.

---

# 4. Core workflow and defining demo

## 4.1 The product's end-to-end story

1. A lead signs in with GitHub OAuth and creates an organization.
2. The lead creates a project with a start date and target delivery date.
3. The lead adds tasks, remaining estimates, due dates and finish-to-start dependencies.
4. TeamOS validates that the dependency graph is acyclic.
5. The risk engine calculates blocked tasks, forecast dates, slack and critical paths.
6. The lead changes an estimate in a what-if panel. TeamOS shows before/after impact without saving the change.
7. Later, the lead connects a GitHub App to selected repositories.
8. A pull request is linked to a task using a task key such as `PROJ-123`.
9. A stalled pull request appears as evidence and may create a status-change proposal.
10. AI creates a project health narrative from a verified risk snapshot and the exact source records.
11. The lead reviews the report and approves or rejects proposed changes.
12. Every state-changing action is recorded in the audit history.

## 4.2 Illustrative risk scenario

A backend authentication task is delayed. Three dependent tasks cannot begin on time. TeamOS recomputes the forecast using the current task graph and remaining estimates. It identifies the downstream tasks whose dates moved, shows the prior and updated dates, and highlights whether the project's forecast finish now exceeds its target date. If a connected pull request has stalled, the report cites that pull request as additional evidence.

**The risk calculation is not done by an LLM.** The model may explain verified facts in plain language but must not invent dates, percentages, task states or dependencies.

## 4.3 Evidence-backed claim definition

A report claim is evidence-backed only when:

- It has a claim type from a controlled list.
- It references IDs of tasks, dependencies or GitHub events in the same organization.
- A verifier confirms that the IDs exist and belong to the current tenant.
- Any numeric/date fields match the stored risk snapshot produced by the risk engine.
- The report stores the snapshot identifier/hash so the report can be reproduced.

If a claim cannot pass verification, reject it or render it as an explicitly unverified note—not as a fact.

---

# 5. Product scope and release boundaries

## 5.1 First 30-day foundation

The first 30 days build the trustworthy non-AI core:

- GitHub OAuth sign-in and secure session handling.
- Organizations, memberships, invitations and owner/admin/member roles.
- Projects and tasks.
- Task status, assignee, remaining estimate and due date.
- Finish-to-start dependencies with cycle prevention.
- Deterministic risk engine.
- What-if forecast preview.
- Append-only audit events.
- Manual proposal/approval mechanism to validate review and commit semantics before AI is added.
- Minimal Next.js UI for the core workflow.
- Automated tenant-isolation and authorization tests.

**No AI model call is required to pass the first-30-day gate.** The proposal system can be tested using hand-authored structured proposals.

## 5.2 Days 31–45: AI planning

- LLM provider interface.
- Per-organization AI budget reservation and usage accounting.
- Brief-to-plan structured output.
- Zod/schema validation and semantic validation.
- Editable proposal review screen.
- Approval-time revalidation.
- Golden evaluation set of at least 25 realistic, messy briefs.
- Prompt-injection cases in the evaluation set.

## 5.3 Days 46–60: GitHub integration

- Register and configure a GitHub App.
- Install on selected repositories.
- Store installation and repository metadata.
- Receive required pull-request events.
- Verify webhook HMAC signature over the raw request body.
- Deduplicate deliveries.
- Process asynchronously and idempotently.
- Link PRs to tasks using a documented task-key convention.
- Show PR status/activity as evidence.
- Generate a status-change proposal; never silently mutate task state.

GitHub OAuth for user sign-in and a GitHub App for repository integration are separate concerns. The GitHub documentation generally prefers GitHub Apps for integrations because of granular permissions, selected-repository access and short-lived installation tokens.

## 5.4 Days 61–90: evidence-backed reports and pilot

- Risk snapshot generation.
- AI narrative generated only from verified claims.
- Evidence references to task and PR records.
- Report reproducibility and evaluation.
- Pilot onboarding for a small number of real teams.
- Feedback collection and reliability fixes.

## 5.5 Explicitly out of scope initially

- Meeting bots joining live calls; start with transcripts only if later justified.
- Document editor or collaborative document editing.
- General-purpose workspace chatbot.
- Calendar/email/Slack integrations.
- Duplicate-work detection.
- Unsupervised autonomous agents.
- Microservices, Kafka, Kubernetes/EKS and multi-region deployment.
- Dedicated database/schema per tenant.
- Enterprise SSO/SAML, SCIM, billing, mobile apps and custom role builder.
- Vector database/pgvector before a real semantic retrieval feature exists.

---

# 6. Functional requirements

Priority labels:
- **P0-Core:** required for the first working, tenant-safe product foundation.
- **P0-MVP:** required for the complete initial product, but may follow the first 30 days.
- **P1:** post-MVP enhancement.

| ID | Requirement | Priority | Target window |
|---|---|---|---|
| FR-01 | GitHub OAuth sign-in and secure sessions | P0-Core | Days 1–14 |
| FR-02 | Create organization and invite members | P0-Core | Days 8–14 |
| FR-03 | Owner/admin/member authorization | P0-Core | Days 8–14 |
| FR-04 | Create/manage projects and tasks | P0-Core | Days 15–21 |
| FR-05 | Task dependencies and cycle prevention | P0-Core | Days 15–21 |
| FR-06 | Blocked, forecast, slack and critical-path calculations | P0-Core | Days 18–25 |
| FR-07 | What-if impact preview without writes | P0-Core | Days 22–25 |
| FR-08 | Append-only audit log for state changes | P0-Core | Days 8–30 |
| FR-09 | Manual proposal review, edit, approve and reject | P0-Core | Days 22–30 |
| FR-10 | Per-org AI budget and model-call logging | P0-MVP | Days 31–45 |
| FR-11 | Generate plan proposals from a brief | P0-MVP | Days 31–45 |
| FR-12 | Install GitHub App and link repositories | P0-MVP | Days 46–60 |
| FR-13 | Ingest PR events and link them to tasks | P0-MVP | Days 46–60 |
| FR-14 | Propose task status changes from PR activity | P0-MVP | Days 46–60 |
| FR-15 | Evidence-backed project health report | P0-MVP | Days 61–90 |
| FR-16 | Task comments | P1 | After MVP |
| FR-17 | WebSocket live updates | P1 | After MVP |
| FR-18 | In-app notifications | P1 | After MVP |

### Non-functional requirements (targets, not achieved results)

- Zero cross-tenant reads in automated tests using the actual runtime database role.
- Every state-changing action is audited in the same transaction as the change.
- GitHub webhook endpoint performs signature verification and stores a deduplicated delivery before returning 2XX; expensive processing runs asynchronously.
- Risk engine performance is benchmarked on a generated 2,000-task project; an initial target of <500 ms may be used as a hypothesis, not a published guarantee.
- AI budget reservation fails closed when the organization has no available budget.
- All background handlers tolerate duplicate delivery.
- No AI-generated claim is displayed as fact without verification.

---

# 7. Technology stack

The stack below is the recommended baseline. Pin mutually compatible stable versions during repository setup and record them in the lockfile. Do not blindly upgrade versions mid-sprint.

## 7.1 Primary stack

| Layer | Technology | Use in TeamOS | Decision |
|---|---|---|---|
| Web app | Next.js App Router + React + TypeScript | Authenticated product UI, server-rendered routes, client interactions | Use |
| UI system | Tailwind CSS + shadcn/ui | Consistent accessible interface | Use |
| Forms | React Hook Form + Zod (where useful) | Validated forms and shared schemas | Recommended; keep lightweight |
| Server state | TanStack Query or a consistent server-action/fetch strategy | API caching, mutation state and invalidation | Choose one pattern; avoid duplicate state systems |
| API | NestJS + TypeScript | REST API, guards, domain modules and integration endpoints | Use |
| API contract | OpenAPI | Contract visibility and client generation later | Add early |
| Runtime | Node.js LTS | Frontend/API/worker runtime | Use supported LTS at setup |
| Package manager | pnpm workspaces | Monorepo dependency management | Use |
| Primary database | PostgreSQL | Relational source of truth, constraints, RLS, audit/outbox | Use |
| ORM | Prisma | Normal data access and migrations | Use with a tenant wrapper; raw SQL where required |
| Validation | Zod for shared/AI schemas; DTO validation at API boundary | Parse untrusted input and model outputs | Use consistently |
| Background processing | PostgreSQL outbox + one worker | Reliable asynchronous processing in early product | Start here |
| Queue expansion | Redis + BullMQ | Delayed jobs, rate limits, multiple queues/workers when required | Defer until measured trigger |
| Integrations | GitHub App | Repository-scoped access and webhook events | Use after core |
| AI | Provider-neutral LLM gateway | Brief-to-plan and later report narrative | Add after deterministic core |
| Containers | Docker + Docker Compose | Reproducible local environment and deployment artifact | Use |
| CI | GitHub Actions | Lint, typecheck, tests, migrations, secret scans, build | Use |
| Observability | Structured logs + OpenTelemetry | Request/job traces and diagnostic context | Add incrementally |

## 7.2 Deliberately deferred technologies

| Technology | Why deferred | Trigger to reconsider |
|---|---|---|
| Redis/BullMQ | Adds stateful infrastructure; outbox/worker sufficient for early jobs | Need delayed jobs, per-queue rate limits, priorities, many workers or DB queue pressure |
| pgvector | Semantic retrieval is not needed for task graph risk calculations | Documents/transcripts/search become a validated product feature |
| Separate vector DB | Unnecessary operational system initially | Measured retrieval scale/feature requirements justify it |
| MongoDB | Core entities are relational and need constraints/transactions | A specific bounded document model justifies a separate store |
| Neo4j | Task DAG can be handled with relational edges and in-memory algorithms | Graph query patterns demonstrably exceed relational approach |
| Microservices | No independent teams or scaling bottleneck yet | A module needs independent release/scale boundary and the team can operate it |
| Kubernetes/EKS | High operational overhead for a single modular app and worker | Several independently deployed services and platform capability exist |
| Kafka | No high-volume durable event-stream requirement | Measured event throughput/retention/fan-out needs demand it |
| Multi-region | Complicates data consistency and operations | User geography/contractual availability needs justify it |

## 7.3 Version and dependency policy

- Use supported stable releases, not prerelease/RC builds, for the baseline.
- Check official compatibility matrices before selecting Node, Next.js, NestJS, Prisma and PostgreSQL versions.
- Pin dependency versions via the lockfile; update intentionally through pull requests.
- Use Dependabot or an equivalent dependency update process.
- Review new packages before adding them; prefer standard platform capabilities when sufficient.
- Never put credentials in source, Docker build arguments, frontend environment variables or committed `.env` files.

---

# 8. System architecture

## 8.1 Architecture style

**Modular monolith with two runtime processes:** one NestJS codebase/container image started as an API process and a worker process. Both use PostgreSQL, but they have different database roles and responsibilities. The Next.js browser app calls the API; it never connects directly to PostgreSQL, GitHub or the LLM provider.

## 8.2 Runtime diagram

```text
                     Browser / Next.js
                            |
                         HTTPS REST
                            |
                    NestJS API process
                     /       |       \
             Auth/RBAC   Domain API   Webhook receiver
                 |           |             |
                 +-----------+-------------+
                             |
                    PostgreSQL database
               (tenant RLS + audit + outbox)
                             |
                      outbox/job claim
                             |
                    NestJS worker process
                      /             \
             GitHub API            LLM provider
```

## 8.3 Domain modules

- `identity`: user records, OAuth callback, sessions and account lifecycle.
- `tenancy`: organizations, memberships, invitations and organization context.
- `projects`: projects, tasks, estimates and task status.
- `dependencies`: edge creation, cycle prevention and dependency reads.
- `risk-engine`: pure TypeScript calculations, with no NestJS/Prisma/I/O imports.
- `proposals`: validated plan/status proposals, review and approval.
- `audit`: append-only record of human, system, GitHub and AI actions.
- `outbox`: transactional event publishing and job lifecycle.
- `github`: GitHub App installation, repository links, webhook normalization and PR mapping.
- `ai`: provider gateway, plan generation, health-report narration, cost and evaluation hooks.
- `database`: Prisma client, SQL repositories, `withTenant` and restricted platform functions.

## 8.4 Dependency rules

1. Dependencies point toward lower-level modules; no circular module imports.
2. Each module owns its tables and exposes a small service interface.
3. The risk engine has no framework, database or network imports.
4. Only the database module creates the Prisma client; application modules receive an approved transaction handle.
5. No LLM or external HTTP call occurs inside a database transaction.
6. Cross-module state changes share one transaction when atomicity is required; asynchronous follow-up uses an outbox row written in the same transaction.
7. Enforce boundaries with lint/import rules and code review.

## 8.5 API request lifecycle

1. Authenticate the session.
2. Resolve organization from the route and verify membership/role.
3. Create an immutable request context containing user ID, organization ID, request ID and role snapshot.
4. Call `withTenant(context, callback)`.
5. The database module starts an interactive Prisma transaction and sets transaction-local tenant/user context.
6. Domain service reads/writes rows; state changes write audit rows and required outbox rows in the same transaction.
7. Commit; return a response that contains no data outside the authorized scope.

---

# 9. Repository structure

Recommended initial monorepo:

```text
teamos/
├── apps/
│   ├── web/                     # Next.js frontend
│   ├── api/                     # NestJS HTTP API
│   └── worker/                  # Worker process using shared domain modules
├── packages/
│   ├── database/                # Prisma schema, SQL migrations, withTenant
│   ├── contracts/               # Shared request/response and event schemas
│   ├── risk-engine/             # Pure deterministic TypeScript library
│   ├── ai/                      # Provider interface, prompts, output schemas
│   ├── integrations/            # GitHub integration contracts/helpers
│   └── config/                  # Shared TS, lint and test config
├── infrastructure/
│   ├── docker/                  # Dockerfiles and local infra
│   └── terraform/               # Later AWS infrastructure
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── database/
│   ├── security/
│   ├── decisions/               # ADRs
│   ├── operations/
│   └── learning/
├── tests/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── load/
├── .github/workflows/
├── AGENTS.md
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

Do not add Turborepo or another build orchestrator unless the workspace actually needs task caching or more advanced build pipelines. Begin with pnpm workspaces and standard scripts.

---

# 10. Data model and database design

## 10.1 Source of truth

PostgreSQL is the source of truth for product state. The application must not keep authoritative task status or dependencies only in Redis, browser state, vector indexes or LLM context.

## 10.2 Core entities

| Entity | Important fields | Purpose |
|---|---|---|
| `users` | id, github_user_id, login, display_name, created_at | Global user identity; no `org_id` because one user may join multiple organizations |
| `organizations` | id, name, slug, ai_budget_cents_monthly, created_at | Tenant boundary |
| `memberships` | org_id, user_id, role, created_at | User's membership and role within an organization |
| `projects` | id, org_id, key, name, start_date, due_date, timezone, next_task_number, created_by | Project container |
| `tasks` | id, org_id, project_id, number, title, description, status, assignee_id, remaining_estimate_workdays, due_date, version, created_by, timestamps | Work item |
| `task_dependencies` | org_id, project_id, blocker_task_id, blocked_task_id, created_by | Directed finish-to-start dependency edge |
| `proposals` | id, org_id, project_id, kind, state, payload, created_by, reviewed_by, timestamps | Human-reviewable change set |
| `audit_events` | id, org_id, actor_type, actor_id, action, entity_type, entity_id, before_data, after_data, request_id, created_at | Append-only action history |
| `outbox_events` | id, org_id, type, payload, dedupe_key, status, attempts, available_at, locked_until, last_error, processed_at | Reliable asynchronous work trigger |
| `ai_runs` | id, org_id, project_id, kind, state, requested_by, input_hash, timestamps | Model workflow lifecycle |
| `ai_calls` | id, org_id, run_id, provider, model, token counts, cost, latency, status, retention metadata | AI usage/cost/diagnostic record; minimize retained prompt content |

Later GitHub tables:

- `github_installations`: GitHub App installation ID and organization mapping.
- `github_repositories`: repository identity, installation, project link and active state.
- `github_pull_requests`: repository, PR number, URL, title, state, head/base refs, updated timestamp and linked task.
- `webhook_events`: delivery ID, event/action, raw or minimized payload, receipt time, processing state and attempts. This is a platform table and needs restricted access because it crosses tenant boundaries during ingestion.
- `reports`: project, snapshot ID/hash, verified claims and generated narrative.

Later AI budget tables (recommended correction):

- `ai_budget_periods`: org_id, period_start, budget_limit, reserved_amount, settled_amount and version.
- `ai_budget_reservations`: org_id, idempotency_key, reserved_amount, state, provider request reference, actual amount, timestamps.

## 10.3 Entity relationship overview

```text
USERS ----< MEMBERSHIPS >---- ORGANIZATIONS ----< PROJECTS ----< TASKS
                                                   |                |
                                                   |                +----< TASK_DEPENDENCIES >---- TASKS
                                                   |
                                                   +----< PROPOSALS
                                                   +----< AI_RUNS ----< AI_CALLS
                                                   +----< AUDIT_EVENTS
                                                   +----< OUTBOX_EVENTS
                                                   +----< GITHUB_INSTALLATIONS ----< GITHUB_REPOSITORIES
                                                                                   |
                                                                                   +----< GITHUB_PULL_REQUESTS >---- TASKS
```

## 10.4 Integrity constraints

- Every tenant-owned table has `org_id`.
- Unique constraints are scoped by `org_id` when identifiers are tenant-local.
- Tenant relationships use composite foreign keys such as `(org_id, project_id)` and `(org_id, project_id, task_id)` so records cannot reference another tenant or project.
- Task dependencies cannot point to themselves.
- The API prevents cycles before insertion; a project-level lock serializes concurrent edge changes.
- `tasks.version` supports optimistic concurrency. An update succeeds only when the caller's expected version matches; otherwise return `409 Conflict`.
- Task number allocation occurs while holding the project row lock so concurrent creates cannot duplicate numbers.
- Unknown estimates remain `NULL`; never silently coerce them to zero.
- Audit rows are append-only for the runtime role (INSERT/SELECT only; no UPDATE/DELETE).

## 10.5 RLS policy model

Recommended model: one shared database and schema, with `org_id` on every tenant table and forced PostgreSQL Row-Level Security. RLS is a second security boundary behind application authorization, not a replacement for it.

- Enable RLS and FORCE RLS on each tenant table.
- Runtime application roles must not be table owners, superusers or `BYPASSRLS` roles.
- Transaction-local context supplies `app.org_id` and `app.user_id`.
- Missing tenant context must match no rows (fail closed).
- `USING` restricts visible/updatable rows; `WITH CHECK` restricts inserted/updated rows.
- Be aware that permissive RLS policies combine with OR by default. Do not accidentally add a broad policy that weakens isolation.
- Foreign-key and unique checks can reveal existence information outside ordinary row filtering; composite tenant keys and scoped uniqueness reduce that risk.
- Run tests as the actual runtime role, never only as a table owner or superuser.

### Prisma integration pattern

All tenant database access goes through one private `withTenant(context, fn)` wrapper:

```ts
async function withTenant<T>(context: TenantContext, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.org_id', ${context.orgId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', ${context.userId}, true)`;
    return fn(tx);
  });
}
```

This is an architectural pattern, not drop-in production code. Confirm the Prisma major version, transaction behavior, pooler configuration, connection reuse, timeout settings and nested-transaction behavior. Keep transactions short. Never call an LLM, GitHub API or other network service while holding a database transaction open. The raw Prisma client must not be imported by feature modules.

## 10.6 Important platform-table exception

The outbox and webhook inbox are operational tables that may need cross-tenant claiming. They must not become general-purpose cross-tenant data stores.

Recommended permission boundary:

- API role can insert an outbox event in the same tenant transaction, but cannot list all tenants' queued events or update arbitrary queue state.
- Webhook receiver role can insert a signature-verified, deduplicated delivery into a narrow inbox interface; it cannot read tenant project data.
- Worker can claim a minimal event envelope through a tightly scoped function, then switch to a tenant-scoped transaction to load actual records.
- A restricted `SECURITY DEFINER` function, if used, must have a fixed safe `search_path`, narrowly defined owner, revoked public execution and only required grants. Never grant ordinary app code unrestricted `BYPASSRLS` to solve queue access.
- Keep platform payloads minimal and avoid storing secrets or full customer documents in unprotected queue payloads.
- Add named exceptions to the RLS catalog test; all unexplained exceptions fail CI.

These are required design corrections to Claude Stage 2, not claims that the original SQL already implements them.

---

# 11. Multi-tenancy and security architecture

## 11.1 Five layers of tenant protection

1. **Application authorization:** verify membership and role for every organization/project/task action.
2. **Database RLS:** forced tenant policy on every tenant-owned table.
3. **Composite keys:** prevent cross-tenant and cross-project references.
4. **Automated tests:** test every endpoint with two organizations and the actual non-owner runtime roles.
5. **Non-database surfaces:** tenant-scoped cache keys, queue envelopes, object-storage paths, logs, AI prompts and report references.

A tenant ID in a cache key or queue message is not proof of authorization. Re-resolve the tenant and permission context before processing sensitive records.

## 11.2 Database roles (proposed)

| Role | Intended privilege | Must not have |
|---|---|---|
| Migration owner | DDL, migrations, table/policy ownership | Runtime use or web/API credentials |
| API runtime | Tenant-scoped business queries; insert allowed outbox events | Table ownership, superuser, BYPASSRLS, global queue browse |
| Webhook receiver | Verify request in app layer; insert minimal verified delivery through narrow DB access | Broad tenant-data reads or arbitrary writes |
| Worker runtime | Claim job envelope through restricted function; tenant-scoped reads/writes; external API calls | Unrestricted cross-tenant record access or BYPASSRLS |
| Function owner | Owns narrowly scoped SECURITY DEFINER functions | Login/runtime usage; broad public grants |

The exact role/grant/function design must be implemented and tested with the chosen hosting connection model. Avoid hardcoded passwords in SQL migrations. Provision credentials separately through a secure environment/bootstrap process and secret manager.

## 11.3 Authentication and account bootstrap

- GitHub OAuth is used for user sign-in in the initial product.
- Validate OAuth state and use PKCE where supported by the chosen flow/provider.
- Keep session cookies HttpOnly, Secure in production and appropriately SameSite; implement CSRF protections for state-changing cookie-authenticated requests.
- Do not expose provider tokens to browser JavaScript unless an explicit, reviewed design requires it.
- Account creation/upsert occurs only through the trusted auth callback/service after provider response validation.
- Replace the broad `INSERT ... WITH CHECK (true)` user policy from the preliminary schema with a narrowly controlled account-bootstrap approach; document that database GUCs are context, not identity proof against a compromised application role.

## 11.4 Secrets and sensitive data

- Store GitHub App private key, webhook secret, OAuth client secret and LLM provider credentials in a secret manager or encrypted deployment secret store.
- Never commit `.env`, credentials, tokens or private keys.
- Encrypt stored integration secrets if any must be persisted; prefer minting short-lived GitHub installation tokens on demand.
- Request minimum GitHub App permissions and repository selection.
- Do not send entire repositories or unrelated documents to an LLM. Send minimum necessary, tenant-authorized context.
- Establish provider data terms, retention, training-use and deletion policy before sending customer data to third-party model services.

## 11.5 Threat model priorities

| Threat | Primary control | Verification |
|---|---|---|
| Cross-tenant data access | Authorization + forced RLS + composite FKs | Two-tenant test on every route/repository |
| Runtime role bypasses RLS | Separate owner/runtime roles; boot check | Role-attribute and catalog tests |
| Tenant context leaks through pooled connection | Transaction-local settings only | Interleaved concurrent tenant tests through production-like pooler |
| Forged webhook | HMAC SHA-256 over raw body; constant-time compare | GitHub published test vector and negative tests |
| Duplicate/out-of-order webhook | Delivery ID unique key; updated_at comparison; idempotent handler | Replay, redelivery and out-of-order tests |
| Prompt injection in brief/PR title | No model tools; untrusted content treated as data; schema/semantic validation; human approval | Injection corpus in eval set |
| AI exceeds authority | Model has no direct write path; approver permission rechecked | Member/admin/owner authorization tests |
| AI budget overrun | Atomic reservation; per-org and global caps; fail closed | Concurrent reservation race test |
| Stored XSS/unsafe model output | Render text safely; validate links; no raw HTML execution | Hostile output rendering test |
| Secret leak | Secret manager, scanning and rotation | CI secret scan and rotation drill |
| SSRF | No arbitrary URL fetching in MVP; strict allowlist if introduced | URL and network boundary tests |
| Audit tampering | Runtime role cannot update/delete audit rows | Permission-denial test |
| Sensitive data retention | Data minimization, expiry cleanup and deletion workflow | Retention and organization deletion tests |

Use the current OWASP GenAI LLM Top 10 as one threat taxonomy; recheck the release at implementation time. The 2026 release is listed in the OWASP project's official repository.

---

# 12. Event processing and background work

## 12.1 Start with PostgreSQL outbox + one worker

The API must not call the LLM or GitHub from a normal request transaction. When a state change needs follow-up work, write the business update, audit event and outbox event in the same database transaction. A worker polls/claims ready events and processes them outside the request.

Use an outbox table with:

- `id`, `org_id`, `type`, minimal `payload`, `dedupe_key`.
- `status` (pending/done/dead), `attempts`, `available_at`.
- `locked_until`, `last_error`, `created_at`, `processed_at`.
- Unique constraint on `(org_id, dedupe_key)` where applicable.

Use `FOR UPDATE SKIP LOCKED` or a narrowly scoped claim function for multiple workers. Leases must expire so a crashed worker's job becomes claimable again. Record bounded retries with exponential backoff and a dead-letter state/alert.

**Delivery semantics:** assume at-least-once processing. Exactly-once side effects are not guaranteed. Every handler must use an idempotency key and check whether its effect already occurred.

## 12.2 When to add Redis/BullMQ

Add BullMQ only when you need delayed/scheduled jobs, queue priorities, per-queue or per-installation rate limits, several independent workers, queue tooling, or when outbox backlog/DB load is measured to be a problem. Preserve a `JobQueue` interface so the implementation can change without changing domain modules.

When BullMQ is added, follow its current production guidance, including Redis `maxmemory-policy noeviction`, retries/backoff, stalled-job handling and graceful worker shutdown. A BullMQ job can be processed more than once; processors still must be idempotent.

## 12.3 Worker lifecycle

1. Claim a minimal job envelope.
2. Validate event type and payload schema.
3. Resolve the organization through restricted installation/job mapping.
4. Open tenant-scoped DB transaction to load authorized source records.
5. Commit/close DB transaction before external network calls.
6. Perform GitHub/LLM operation with timeout and bounded retries.
7. Open another short tenant transaction to persist result, audit entry and follow-up outbox event.
8. Mark job complete or retry/dead-letter with safe diagnostic details.

---

# 13. Deterministic delivery-risk engine

This is TeamOS's primary technical differentiator and must be implemented as a pure, deterministic TypeScript package.

## 13.1 Dependency semantics

A dependency is **finish-to-start**: blocker task A must finish before dependent task B may start. (The earlier Stage 2 wording that said “before B can finish” is incorrect and must be corrected.)

Represent an edge as:

`blocker_task_id -> blocked_task_id`

The graph must be a directed acyclic graph (DAG).

## 13.2 MVP calculation rules (recommended baseline)

| Concept | Rule |
|---|---|
| Evaluation date | Current date in the project's configured timezone; store it in each risk snapshot for reproducibility |
| Work calendar | Monday–Friday; no public holidays in MVP |
| Duration unit | Whole remaining working days for the MVP; avoids ambiguous half-day date rounding |
| TODO task | Estimate is its full remaining duration |
| IN_PROGRESS task | Estimate is remaining work as of evaluation date |
| DONE task | Forecast finish is its actual completion date; remaining duration is zero |
| CANCELLED task | Excluded from active forecast path; any dependency on it is flagged for human review rather than silently disappearing |
| Root active task | Earliest start is the later of project start date and evaluation date |
| Dependent active task | Earliest start is the next working day after the latest non-cancelled blocker finish |
| Multiple blockers | Dependent task waits for the latest blocker finish |
| Missing estimate | Forecast for that task is unknown; downstream tasks that require it also have unknown forecast |
| Missing due date | No at-risk classification; show “no due date” rather than assuming a date |
| At risk | Known forecast finish date is later than task due date |
| Slack | Due date minus forecast finish, reported in working days with sign and clear label |
| Project forecast | Latest finish among active terminal tasks; if an active terminal chain is unknown, project finish is unknown/incomplete |
| Critical path | Use forward/backward pass over the active DAG; identify zero-total-float path(s). Preserve ties rather than arbitrarily hiding equal critical paths |

These are proposed MVP semantics. Confirm them with interview feedback and encode them in an ADR before coding. In particular, the estimate unit and handling of cancelled dependencies should not be left implicit.

## 13.3 What-if semantics

- Changing an estimate re-runs the forecast against an in-memory copy of the project graph and returns changed dates, risk state, slack and critical-path changes. It writes nothing.
- Changing a due date does not change forecast dates. It changes slack/at-risk classification only.
- The UI must distinguish “forecast from remaining estimates” from a statistically calibrated prediction.
- Unknown estimates must remain unknown. Never substitute zero.

## 13.4 Algorithm outline

1. Load active project tasks and dependency edges in two tenant-scoped queries.
2. Validate IDs/project ownership and graph acyclicity.
3. Build adjacency lists and indegree counts.
4. Topologically order the graph (Kahn's algorithm or equivalent).
5. Run a forward pass to calculate earliest start/finish dates using the business calendar.
6. Aggregate project finish across terminal tasks.
7. Run a backward pass from project finish to calculate latest dates/total float.
8. Mark all zero-float active tasks/edges as critical; retain multiple tied paths.
9. Derive blocked state, slack and at-risk classification from those computed dates.
10. Emit a versioned snapshot with evaluation date, rule version, input hash and computed outputs.

## 13.5 Edge cases to test

- One task with no dependencies.
- A simple chain.
- A diamond dependency graph.
- Two disconnected branches.
- Multiple terminal tasks.
- Multiple equal critical paths.
- Done predecessor and cancelled predecessor.
- Unknown estimate at root and in the middle of a chain.
- Zero remaining work.
- Weekend start and weekend finish.
- Project start in the future and in the past.
- Due date absent, equal to forecast date, earlier/later than forecast.
- Task estimate change and due-date-only change.
- A cycle attempt.
- Two concurrent edge inserts that would jointly create a cycle.

Use unit tests, property-based tests and independently hand-calculated fixtures. A property test should confirm at minimum: graph remains acyclic; each dependent task does not start before its blockers finish; unknown estimates are not converted to zero; and forecast output is stable for identical input/rule version.

---

# 14. AI architecture and evaluation

## 14.1 AI's role

AI is an assistant over verified application state—not the source of truth and not an unrestricted agent.

Initial AI capabilities:

1. **Brief-to-plan:** convert an unstructured launch brief into a structured proposal of tasks, estimates and dependencies.
2. **Project health narrative:** explain a risk-engine snapshot and cite the exact tasks/dependencies/PRs behind the claims.

No generic chat assistant, unrestricted tools, autonomous background agent or direct DB writes in the initial product.

## 14.2 Plan-generation flow

```text
User submits brief
       |
API stores AI run + outbox event (same tenant transaction)
       |
API returns 202 + run ID
       |
Worker checks atomic organization budget reservation
       |
Worker calls LLM with strict output schema and no tools
       |
Parse JSON + Zod validation + semantic checks
       |
Check project scope, task limits, referenced IDs, duplicate keys and dependency cycles
       |
Store pending proposal + call log + audit event
       |
User reviews/edits proposal diff
       |
Approval endpoint rechecks role, tenant, current project version and graph validity
       |
One transaction creates tasks/edges + audit event + approval state
```

A schema-valid response may still be wrong. Validate IDs, limits, estimate ranges, duplicate tasks, project membership and graph acyclicity. The model must not provide hidden tool access in this workflow.

## 14.3 Provider abstraction

Define a small provider-neutral interface for:

- Model identifier and supported structured-output mode.
- Request/response schema.
- Input/output token counts where available.
- Usage/cost metadata.
- Timeout, retryability and error categories.
- Provider request ID.

Do not create a giant generic AI framework. Keep provider-specific code behind a thin adapter and pin/record the model identifier used for every run.

## 14.4 Atomic AI budget control

A monthly budget check must be safe under concurrent requests.

Recommended flow:

1. Generate an idempotency key for each logical AI run.
2. In a short transaction, atomically reserve a conservative estimated cost only if `settled + reserved + requested <= limit`.
3. Commit the reservation before calling the provider.
4. Make the provider call outside the DB transaction with request/token/time limits.
5. On known success, atomically release reservation and settle actual measured cost.
6. On a definite pre-call failure, release the reservation.
7. On timeout/ambiguous provider outcome, retain an “unknown/awaiting reconciliation” reservation or conservative charge until reconciled; do not release blindly.
8. Enforce both per-organization and global kill switches/caps.

Store currency/units with documented precision. Provider prices change; keep model pricing in configurable metadata and record the price version used for cost calculation. Do not hardcode a price as a permanent fact.

## 14.5 AI data retention

- Store the minimum necessary request/response information.
- Prefer hashes, structured metadata and redacted excerpts over full customer prompts when full content is not needed for support/evaluation.
- Define purpose, retention duration and access controls for every stored prompt/output.
- An `expires_at` column is not a deletion mechanism; implement a scheduled cleanup job and verify deletion.
- Organization deletion must cover AI logs, proposals, reports, integration metadata, outbox and backups according to the declared retention policy.
- Review each provider's data processing, retention, training-use and regional terms before sending customer content.

## 14.6 Project health report flow

1. Risk engine creates a versioned snapshot.
2. Application constructs a closed list of facts/claims, each with entity IDs and computed values.
3. Worker retrieves only tenant-authorized GitHub/task evidence.
4. LLM writes narrative around the supplied claims; it cannot create numeric/date facts or call tools.
5. Verifier checks every claim type, referenced ID, tenant ownership and value against the snapshot.
6. Store report with snapshot hash and model metadata.
7. UI shows citations/links to source task and PR records.

## 14.7 Evaluation

Create a golden dataset of at least 25 messy launch briefs and later report scenarios. Include:

- Missing owners/estimates.
- Ambiguous dates.
- Duplicate requirements.
- Contradictory requirements.
- Invalid or cyclic dependencies.
- Untrusted instructions inside the brief.
- Tasks referencing nonexistent IDs.
- Tenant-crossing ID attempts.

Grade structural validity with code (schema, IDs, limits, DAG, no duplicates). Use human review for usefulness and a model judge only after calibrating it against human ratings. Track quality, latency, token usage, cost and regressions per model/prompt version.

---

# 15. GitHub integration

## 15.1 Authentication vs integration

- GitHub OAuth: user sign-in identity.
- GitHub App: repository integration with fine-grained permissions, selected repository access and installation tokens.

Do not use a broad OAuth token as a substitute for a repository-scoped GitHub App when building the integration.

## 15.2 Event ingestion flow

1. Receive webhook HTTP request and retain the raw body for signature verification.
2. Verify `X-Hub-Signature-256` using HMAC-SHA256 and a constant-time comparison.
3. Validate expected event type/action and request-size limits.
4. Insert delivery with unique GitHub delivery ID into restricted webhook inbox.
5. Return 2XX quickly after durable acceptance.
6. Worker resolves installation-to-organization mapping through a restricted function.
7. Worker processes event in a tenant-scoped transaction.
8. Ignore stale updates using provider update timestamps/version checks.
9. Upsert PR record idempotently.
10. Link PR to task using an explicit task-key convention.
11. Create a proposal when a status change is suggested; do not silently update the task.

Webhook delivery can be duplicated, delayed or delivered out of order. The handler must not assume once-only or ordered delivery.

## 15.3 Minimal GitHub App permissions

Request the smallest set that supports the MVP: repository metadata and pull-request read access; additional issue/commit permissions only if demonstrated by a specific feature. Select only repositories chosen by the installing customer. Document exact requested permissions in the setup screen.

## 15.4 Pull-request-to-task linking

Start with a simple documented convention such as including `PROJ-123` in the PR title or body. Validate that the key exists in the same organization and project context. Treat ambiguous matches as unlinked and ask a user to resolve them; never guess across projects/tenants.

---

# 16. API and frontend design

## 16.1 API conventions

- REST API version prefix: `/api/v1`.
- Organization context in tenant routes, for example `/api/v1/orgs/:orgId/projects`.
- Authentication and membership checks occur before domain service operations.
- Request validation at the edge; response DTOs do not expose secret fields.
- Consistent error envelope with stable error code and request ID.
- Pagination for list endpoints; explicit sorting/filter allowlists.
- Optimistic concurrency via `version` or `If-Match` semantics.
- Idempotency key for retryable create/approval operations.
- OpenAPI contract for endpoints.

## 16.2 Representative endpoints

```text
GET    /api/v1/me
GET    /api/v1/orgs
POST   /api/v1/orgs
POST   /api/v1/orgs/:orgId/invitations
GET    /api/v1/orgs/:orgId/projects
POST   /api/v1/orgs/:orgId/projects
GET    /api/v1/orgs/:orgId/projects/:projectId
POST   /api/v1/orgs/:orgId/projects/:projectId/tasks
PATCH  /api/v1/orgs/:orgId/tasks/:taskId
POST   /api/v1/orgs/:orgId/tasks/:taskId/dependencies
DELETE /api/v1/orgs/:orgId/tasks/:taskId/dependencies/:dependencyId
GET    /api/v1/orgs/:orgId/projects/:projectId/risk
POST   /api/v1/orgs/:orgId/projects/:projectId/what-if
POST   /api/v1/orgs/:orgId/projects/:projectId/proposals
POST   /api/v1/orgs/:orgId/proposals/:proposalId/approve
POST   /api/v1/orgs/:orgId/proposals/:proposalId/reject
GET    /api/v1/orgs/:orgId/audit-events
POST   /api/v1/webhooks/github
```

This is a proposed surface, not a finalized OpenAPI contract. Every route needs authorization tests and a stable error contract.

## 16.3 Initial frontend screens

1. Sign-in.
2. Organization creation and switcher.
3. Organization member/invitation settings.
4. Project list.
5. Project overview/risk panel.
6. Task table/board with status, assignee, estimate and due date.
7. Task detail and dependency editor.
8. Dependency graph view.
9. What-if impact panel showing before/after dates.
10. Proposal review/diff/approval screen.
11. Audit timeline.
12. GitHub integration settings (later milestone).
13. AI plan run status and proposal review (later milestone).
14. Evidence-backed health report (later milestone).

Design the UI around clarity and traceability, not visual complexity. Use real API data for completed features; fixtures may be used only for clearly labeled development/demo seeds.

---

# 17. Testing and engineering quality

## 17.1 Test layers

- **Unit tests:** pure risk algorithms, date functions, validators and permission functions.
- **Property tests:** DAG invariants and deterministic forecasting across generated graphs.
- **Database integration tests:** migrations, constraints, RLS, grants and role attributes on a real PostgreSQL test database.
- **API integration tests:** tenant context, role matrix, transactions, audit writes and concurrency.
- **E2E tests:** browser user journey from sign-in to project/risk/what-if/proposal approval.
- **Security tests:** cross-tenant access, role escalation, webhook signature, unsafe output, secrets and rate limits.
- **AI evaluations:** golden set, structural checks, evidence verification and injection cases.
- **Load/performance tests:** realistic project size, concurrent requests, webhook bursts and queue backlog.

## 17.2 Minimum release gates

- Cross-tenant tests run in CI as the actual runtime role.
- RLS catalog check catches a new tenant table without FORCE RLS/policy.
- Runtime role boot check rejects owner/BYPASSRLS/superuser.
- Tenant wrapper tested with actual Prisma transactions and the intended pooler.
- Interleaved requests for two tenants show no context leakage.
- Concurrent opposite dependency-edge inserts cannot leave a cycle.
- Task update with stale version returns `409 Conflict`.
- Audit insert and business state update commit or roll back together.
- Outbox retry/replay does not duplicate side effects.
- AI budget race test proves no over-reservation.
- GitHub webhook test verifies valid and invalid signatures.
- Build, lint, typecheck and test suite pass on every pull request.
- No secrets are present in repository or build artifacts.

## 17.3 Definition of done for a feature

A feature is done only when:

1. Requirements and acceptance criteria are understood.
2. Authorization and tenant boundaries are implemented.
3. Database constraints/migration are reviewed.
4. Loading, empty, success and failure states exist in the UI/API.
5. Unit/integration/E2E tests appropriate to the feature pass.
6. Audit/outbox behavior is correct where applicable.
7. Documentation is updated.
8. The developer can explain the implementation and trade-offs.
9. Git diff is reviewed and committed.

---

# 18. Deployment, operations and observability

## 18.1 Development

- Docker Compose for PostgreSQL and local services.
- Next.js, API and worker run locally or as containers.
- `.env.example` documents variable names but contains no secrets.
- Local database uses separate migration and runtime roles where feasible.
- Seed data is clearly marked and never mistaken for production customer data.

## 18.2 First hosted environment

For a portfolio/private beta, a managed PaaS may be operationally simpler than building AWS infrastructure immediately. Keep production-like separation between web, API, worker and managed database. Select the provider based on current regional availability, managed backups, networking, pricing and data terms at deployment time.

## 18.3 AWS growth path

When operational needs justify AWS, a sensible starting layout is:

- VPC with public/private subnets.
- Application Load Balancer/reverse proxy at the edge.
- ECS Fargate services for web/API and independently scaled worker.
- RDS PostgreSQL.
- ElastiCache Redis only after queue expansion.
- S3 for private object storage if/when uploads exist.
- Secrets Manager and KMS.
- CloudWatch plus OpenTelemetry-compatible tracing/metrics backend.
- GitHub Actions for build/deploy; Terraform for infrastructure when AWS is adopted.

Do not deploy Kubernetes/EKS just to make the portfolio look advanced. ECS/Fargate or a PaaS is adequate for the initial modular application.

## 18.4 Operational practices

- Separate local, staging and production environments.
- Automated backups and periodic restore drills.
- Database migration review and rollback strategy.
- Health/readiness endpoints.
- Graceful worker shutdown.
- Alert on worker backlog age, dead-letter events, webhook failures, DB pool saturation, 5xx rate and AI budget exhaustion.
- Structured logs include request ID, job ID, organization ID (not sensitive content), actor type and module.
- Redact tokens, prompts and personal data from logs.
- Instrument high-value requests/jobs with OpenTelemetry traces.
- Define an incident runbook for database failure, webhook outage, secret rotation and accidental tenant-data exposure.

---

# 19. Roadmap and acceptance gates

The calendar below is a baseline copied from the Stage 2 planning assumption of approximately 20 focused engineering hours per week. It is an estimate, not a promise. Re-baseline after week 1 using actual effort. Do not compress security testing to preserve dates.

## 19.1 First 30 days (baseline: roughly 86 hours)

| Work item | Approx. effort | Acceptance gate |
|---|---:|---|
| Architecture review and decisions | 3 h | ADRs accepted/amended; open questions recorded |
| Repository, Docker Compose and CI | 5 h | Clean checkout starts services; CI lint/typecheck/tests; secret scan catches fixture secret |
| Apply core DB migration and RLS checks | 5 h | Isolation/integrity tests pass as runtime role |
| Prisma `withTenant` wrapper and import boundary | 5 h | Parallel tenant test passes; raw client cannot be imported by feature modules |
| Five team-lead interviews | 4 h | Persona and risk definitions reviewed |
| Week-1 rebaseline | 3 h | Actual-to-estimate ratio recorded; scope adjusted if needed |
| GitHub OAuth sign-in and session | 8 h | State/CSRF/session/logout tests pass |
| Organization, invite and roles | 7 h | Owner/admin/member endpoint matrix passes |
| Audit module | 5 h | State change and audit row atomic; runtime cannot update/delete audit rows |
| Project/task API | 7 h | Version check returns 409; cross-tenant tests pass; unique task numbering under concurrency |
| Dependency API | 5 h | Self, cross-project and cycle edges rejected; concurrent opposing insert test passes |
| Deterministic risk engine | 9 h | Hand cases, property tests and documented 2,000-task benchmark |
| What-if endpoint | 3 h | Before/after impact returned; no database writes |
| Minimal UI | 8 h | Seeded demo flow works in browser |
| Manual proposal/approval | 7 h | Tasks/edges created only after approval; revalidation and rights tests pass |
| Buffer, fixes and demo | 5 h | Clean database demo, updated documentation |
| **Total** | **86 h** | **30-day foundation accepted** |

The effort estimates are uncalibrated. Actual available hours may be lower or higher; review weekly.

## 19.2 Days 31–45

- Transactional outbox/worker if not already implemented for required background jobs.
- LLM gateway and cost reservation.
- AI brief-to-plan proposal.
- Schema and semantic validation.
- 25-brief evaluation set including injection scenarios.
- User-facing run status and proposal diff.

## 19.3 Days 46–60

- GitHub App registration/configuration.
- Installation and selected repository mapping.
- Signature-verified webhook inbox.
- Idempotent PR events and task-key matching.
- Evidence panel and status-change proposal.

## 19.4 Days 61–90

- Risk snapshot and report claims.
- AI narrative plus evidence verifier.
- Report UI and reproducibility.
- Pilot with a small number of teams.
- Measure trust, usefulness, latency, reliability and cost; then prioritize fixes.

## 19.5 Gates

1. **End of week 1:** tenant isolation tests green in CI using runtime role.
2. **End of week 2:** a user can sign in, create an organization, invite a member and see audit records.
3. **End of week 3:** risk engine passes property tests; what-if results match hand-calculated examples.
4. **Day 30:** clean-database demo works; all tenant API routes covered; no cross-tenant reads.
5. **Day 45:** AI plan generation produces valid proposals, never silently creates tasks, and passes the agreed eval threshold.
6. **Day 60:** GitHub webhook and PR ingestion are signature-verified, deduplicated and tenant-safe.
7. **Day 90:** health report claims are reproducible and evidence-verified; pilot feedback is documented.

---

# 20. Developer learning plan

The developer should learn the concepts while implementing the product, not blindly copy generated code.

| Priority | Concept | Learn before/while building | TeamOS application |
|---:|---|---|---|
| 1 | Authentication vs authorization | Sessions, OAuth, CSRF, RBAC | GitHub sign-in, organization roles |
| 2 | Multi-tenancy and PostgreSQL RLS | Policies, FORCE RLS, DB roles, composite FKs | Tenant isolation |
| 3 | Relational modeling and transactions | FK, unique constraints, MVCC, isolation, locks | Projects/tasks/dependencies |
| 4 | Graph algorithms | DAG, topological sort, CPM, forward/backward pass | Risk engine |
| 5 | Concurrency control | Optimistic versions, row locks, serializable retries | Task edits and cycle prevention |
| 6 | Reliable job processing | Outbox, leases, idempotency, retries, dead letter | AI and webhook processing |
| 7 | Webhook security | HMAC, raw body, delivery IDs, stale events | GitHub integration |
| 8 | LLM application patterns | JSON schema, tool calling, prompting, provider adapter | Plan proposals and report narrative |
| 9 | RAG and retrieval | Chunking, embeddings, hybrid retrieval, permissions | Future document/knowledge features only |
| 10 | AI safety/evaluation | Prompt injection, output validation, golden sets | Trustworthy AI features |
| 11 | Observability | Logs, traces, metrics, alerting | Debugging real deployments |
| 12 | Cloud deployment | Containers, networking, secrets, backups, CI/CD | Hosting and operating TeamOS |

For each milestone, the AI mentor should explain the concept from first principles, show where it appears in TeamOS, give a small practical exercise, review the developer's answer, then proceed.

---

# 21. Risks, assumptions and open decisions

## 21.1 Key assumptions

- Initial customer persona is a team lead in a 5–25-person software team.
- Teams use GitHub and maintain at least some task/estimate/dependency data.
- A five-day working week without holidays is acceptable for the first forecast model.
- A single shared PostgreSQL schema is acceptable for early tenants if isolation controls are properly implemented.
- Approximately 20 focused hours/week is the baseline schedule from Stage 2; this must be confirmed against reality.
- The initial goal is portfolio-first with product quality and startup potential, not a promise to launch a funded company.

## 21.2 Unresolved decisions to close before coding

1. Confirm weekly development hours and adjust calendar estimates.
2. Choose exact stable compatible versions of Node, Next.js, NestJS, Prisma and PostgreSQL.
3. Choose initial hosting: PaaS first or AWS from day one. Default recommendation: PaaS/private beta first; AWS when justified or as a learning milestone.
4. Choose authentication library and verify the current GitHub OAuth security flow.
5. Approve the database-role and platform-table access design.
6. Approve risk-engine date/estimate semantics, especially cancelled dependencies and unknown estimates.
7. Decide whether first user-facing demo is one seeded organization or a complete self-service onboarding flow.
8. Recruit five interviewees and later three pilot teams if possible.

## 21.3 Known limits

- Forecasts are only as good as remaining-estimate quality and the dependency graph. They are not capacity-aware predictions.
- The first model ignores holidays, team availability, partial days and resource contention.
- A single shared database creates a noisy-neighbor risk.
- An authorized user can still approve a misleading proposal; the review UI must show an exact diff and clear evidence.
- No architecture document proves security. Tests, deployment configuration, code review and operational practice must validate controls.

---

# 22. Definition of done for TeamOS private beta

The private beta is ready only when:

- A user can sign in, create an organization and invite a teammate.
- Organization and project roles are enforced server-side.
- Projects, tasks and finish-to-start dependencies work with proper constraints.
- Cycle creation is prevented, including concurrent attempts.
- Risk engine outputs are deterministic, versioned and tested against edge cases.
- What-if preview changes no stored records.
- Audit events exist for all state-changing operations and cannot be altered by runtime roles.
- AI plan proposals are schema/semantically validated and only applied after authorized human approval.
- GitHub events are signature-verified, deduplicated and processed idempotently.
- Report claims cite source records and match risk snapshots.
- Cross-tenant tests pass on every relevant data path.
- Backup/restore and incident procedures are documented and exercised.
- A small real pilot team can use the system for an actual project and give actionable feedback.

**Production readiness is not a badge or a generated README. It is demonstrated by tested controls, reliable operations and observed use by real users.**

---

# 23. Official technical references

These links are starting points. Re-check the documentation for the exact versions selected during implementation. The Stage 2 research document noted that it consulted excerpts rather than reading every source page in full; treat exact version details and advanced behaviors as items to verify before relying on them.

1. PostgreSQL — Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
2. PostgreSQL — WITH queries, recursive CTEs and cycle detection: https://www.postgresql.org/docs/current/queries-with.html
3. PostgreSQL — SELECT locking clauses / SKIP LOCKED: https://www.postgresql.org/docs/current/sql-select.html
4. Prisma — Transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
5. NestJS — Modules and dependency boundaries: https://docs.nestjs.com/modules
6. GitHub — GitHub Apps vs OAuth Apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
7. GitHub — Registering a GitHub App: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app
8. GitHub — Validating webhook deliveries: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
9. BullMQ — Production guidance: https://docs.bullmq.io/guide/going-to-production
10. BullMQ — Retrying jobs: https://docs.bullmq.io/guide/retrying-failing-jobs
11. BullMQ — Stalled jobs: https://docs.bullmq.io/guide/workers/stalled-jobs
12. pgvector — Official repository and README: https://github.com/pgvector/pgvector
13. Anthropic — Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
14. OWASP — GenAI LLM Top 10 2026: https://github.com/GenAI-Security-Project/GenAI-LLM-Top10/tree/main/2026
15. Docker — Build best practices: https://docs.docker.com/build/building/best-practices/
16. Next.js — Self-hosting guide: https://nextjs.org/docs/app/guides/self-hosting

---

## Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 7 Nov 2026 | Consolidated product and engineering blueprint. Reconciled 30-day vs 90-day scope. Added explicit corrections for dependency semantics, platform table access, user bootstrap, AI budget reservations and data retention. |

**End of document.**
