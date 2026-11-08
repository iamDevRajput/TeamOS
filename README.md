# TeamOS

> **Delivery Risk Intelligence for Engineering Teams.**<br/>
> Grounded in project tasks, finish-to-start dependencies, and GitHub pull request activity to answer:<br/>
> *Will the team hit its delivery date? What is blocking delivery? Which tasks and milestones are affected? What changed and what evidence supports that conclusion?*

---

## 1. Project Overview

Modern software engineering teams struggle with delivery visibility. Project boards track ticket status ("In Progress", "Done"), but they fail to account for finish-to-start dependency chains, critical path delays, or cross-functional blockers. When schedules slip, teams often rely on subjective updates, disconnected spreadsheets, or hallucinated AI summaries.

**TeamOS** is an open-source, multi-tenant SaaS foundation that provides **Delivery Risk Intelligence**:
- **Deterministic Forecasting:** Replaces guesswork with pure Critical Path Method (CPM) graph algorithms.
- **Evidence-Backed Health Snapshots:** Every reported risk metric or milestone projection cites verified database entity citations, sealed with a cryptographic SHA-256 digest.
- **Human-in-the-Loop AI Planning:** AI generates structured task breakdown proposals that require human review and approval; LLMs never write directly to product database state.
- **PostgreSQL Forced Multi-Tenancy:** Hardened Row-Level Security (RLS) ensures complete data isolation across organizations.

TeamOS is designed from first principles as a modular monolith in a TypeScript monorepo, prioritizing correctness, auditability, and deterministic graph math.

---

## 2. Key Features

- **Multi-Tenant Organizations & RBAC:** Complete organizational workspaces isolated by PostgreSQL forced RLS. Role-Based Access Control (`OWNER`, `ADMIN`, `MEMBER`) with last-owner protection and secure invitation tokens.
- **Project & Task Management:** Sequential per-project task numbering (`[KEY]-[NUM]`), status boards (Kanban & Table), assignees, remaining estimate tracking, and Optimistic Concurrency Control (OCC) using monotonic version checks (`HTTP 409 Conflict` on race conditions).
- **Finish-to-Start Dependencies & DAG Visualizer:** Directed Acyclic Graph (DAG) task relationships. Multi-stage topological visualizer, visual `🔒 Blocked` badges, and cycle rejection before database insertion.
- **Deterministic Critical Path Method (CPM):** Calculates forward pass (early start/finish), backward pass (late start/finish), total/free float (slack), and zero-slack critical paths without external services.
- **What-If Simulation Sandbox:** Interactive in-memory scenario modeling. Allows engineering managers to test estimate changes, scope expansions, or schedule slippages without mutating the underlying database.
- **AI-Assisted Planning Engine:** Transforms natural language engineering briefs into structured, DAG-verified task breakdown proposals using a Google Gemini provider abstraction.
- **Proposal Review & Atomic Application:** Structured change sets (task creates, updates, deletes, dependency additions/removals) staged in `PENDING` status. Changes only mutate the project when an authorized administrator reviews the exact diff and approves.
- **Evidence-Backed Health Reports:** Generates authoritative risk reports (Delivery Status, Critical Path, Blocked Tasks, Forecast Completion) where every claim cites verified entity IDs.
- **Cryptographic Snapshot Integrity:** Generates SHA-256 hashes over referenced task states to detect post-report modifications and guarantee verifiable ground truth.
- **Append-Only Audit Timeline:** Centralized, immutable security log recording all state mutations atomically alongside business operations, complete with payload diff viewers.
- **GitHub OAuth & GitHub App Architecture:** Secure browser authentication using RFC 6265bis HTTP-only session cookies with SHA-256 token hashing; webhook receiver with constant-time HMAC-SHA256 signature verification and delivery deduplication.
- **Atomic AI Budgeting & Accounting:** Per-organization monthly spend caps, row-level concurrency locks (`FOR UPDATE`), and idempotent reservation/settlement lifecycles.
- **Transactional Outbox & Worker:** Reliable background processing using PostgreSQL transactional outbox (`claim_next_outbox_event` via `FOR UPDATE SKIP LOCKED`) and automated session maintenance.

---

## 3. Architecture Overview

```mermaid
flowchart TD
    subgraph Client["Frontend Layer (Next.js 14)"]
        UI["Web UI\n(App Router + Tailwind CSS)"]
        Board["Kanban & Table Board"]
        DAG["Topological DAG Visualizer"]
        WhatIf["What-If Simulation UI"]
        Reports["Verified Health Reports"]
        AuditUI["Audit Timeline"]
    end

    subgraph API["Backend Modular Monolith (NestJS)"]
        AuthModule["Identity & OAuth Module"]
        TenancyModule["Tenancy & RBAC Module"]
        ProjectsModule["Projects & Tasks Module"]
        DepModule["Dependencies Module"]
        RiskModule["Risk Engine Controller"]
        ProposalModule["Proposals Module"]
        AIModule["AI Planning Module"]
        ReportModule["Reports Module"]
        AuditModule["Audit Service"]
        GithubModule["GitHub Webhook Service"]
    end

    subgraph Engine["Pure Domain Logic (@teamos/risk-engine)"]
        CPM["Critical Path Method (CPM)"]
        TopSort["Kahn's Topological Sort"]
        Slack["Float & Slack Calculator"]
        Verifier["Ground-Truth Claim Verifier"]
    end

    subgraph Storage["PostgreSQL 16 Database"]
        RLS["Forced Row-Level Security (RLS)"]
        Tables["Organizations, Projects, Tasks, Dependencies"]
        AuditTable["Append-Only Audit Log"]
        Outbox["Transactional Outbox"]
        Sessions["Identity Sessions (Hash-stored)"]
    end

    subgraph Worker["Background Worker (@teamos/worker)"]
        OutboxWorker["Outbox Processor (SKIP LOCKED)"]
        SessionSweeper["Session Cleanup Worker"]
    end

    subgraph External["External Services"]
        GH["GitHub API & Webhooks"]
        Gemini["Google Gemini LLM"]
    end

    UI --> API
    API --> Engine
    API --> Storage
    Worker --> Storage
    GithubModule --> GH
    AIModule --> Gemini
```

---

## 4. Technology Stack

Verified against monorepo package manifests:

| Layer | Technologies | Key Packages |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS | `next`, `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer` |
| **Backend API** | NestJS 10, Express, TypeScript, RxJS, Cookie-Parser | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `cookie-parser`, `rxjs` |
| **Database & ORM** | PostgreSQL 16 (Alpine), Prisma ORM, Node-Postgres | `prisma`, `@prisma/client`, `pg`, Docker Compose |
| **Risk Engine** | Pure TypeScript (Zero external framework or network dependencies) | Deterministic topological DAG, CPM forward/backward pass, What-If simulator |
| **AI Integration** | Thin provider abstraction (Google Gemini REST API, Mock LLM Provider) | Structured JSON outputs, atomic pre-allocation budgeting, prompt delimitation |
| **Security & Auth** | Node.js built-in `crypto` | Constant-time HMAC-SHA256, RS256 JWT, SHA-256 hashing, RFC 6265bis cookies |
| **Background Jobs** | Node.js Worker, PostgreSQL Transactional Outbox | `FOR UPDATE SKIP LOCKED` claim function |
| **Testing & QA** | Vitest, Playwright CLI, Docker | `vitest`, `playwright-cli` |

---

## 5. Repository Structure

```
PROJECT-K/
├── apps/
│   ├── api/                   # NestJS REST API modular monolith
│   │   ├── src/
│   │   │   ├── ai/            # Gemini LLM provider, budget locking & evaluation tests
│   │   │   ├── audit/         # Audit trail controller & query service
│   │   │   ├── dependencies/  # Task dependency edges & cycle checks
│   │   │   ├── github/        # GitHub App authentication & webhook receiver
│   │   │   ├── health/        # Liveness & readiness probes
│   │   │   ├── identity/      # GitHub OAuth, cookie sessions & security guards
│   │   │   ├── projects/      # Projects & tasks with optimistic concurrency
│   │   │   ├── proposals/     # Proposal review, diffing & atomic approval
│   │   │   ├── reports/       # Ground-truth verified project health reports
│   │   │   ├── risk/          # Delivery risk calculations & what-if simulation
│   │   │   └── tenancy/       # Organizations, memberships, invitations & RBAC guards
│   ├── web/                   # Next.js 14 App Router frontend
│   │   ├── src/
│   │   │   ├── app/           # Root layout, login state, and main dashboard
│   │   │   └── components/    # TaskBoard, DependencyGraph, RiskOverviewPanel, etc.
│   └── worker/                # Background outbox worker and session cleanup daemon
├── packages/
│   ├── config/                # Strict TypeScript & ESLint configurations
│   ├── contracts/             # Shared TypeScript types, DTOs, and API interfaces
│   ├── database/              # Prisma schema, migrations, RLS wrapper (withTenant), SQL functions
│   └── risk-engine/           # Pure deterministic CPM, DAG topological sort, and snapshot verifier
├── docs/                      # Blueprints, backup/restore runbooks, and QA verification reports
├── scripts/                   # Database backup/restore and verification scripts
├── docker-compose.yml         # Local PostgreSQL container configuration
└── pnpm-workspace.yaml        # pnpm monorepo workspace definition
```

---

## 6. Architecture & Security Principles

1. **Forced Multi-Tenant Row-Level Security (RLS):**
   - Every tenant table has an `org_id` column and an enforced PostgreSQL RLS policy.
   - The runtime application connects via `teamos_api_role`, which cannot bypass RLS.
   - All tenant queries execute through `withTenant(context, callback)`, using parameterized `SET LOCAL app.org_id` within short interactive transactions. Queries with missing tenant context fail closed (0 rows).
2. **Database Role Privilege Separation:**
   - `teamos_owner`: Executes schema migrations and owns DDL objects. Never used by application runtime.
   - `teamos_api_role`: Has DML permissions only (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) subject to forced RLS. Cannot run DDL.
   - `teamos_worker_role`: Dedicated connection for the background worker to claim outbox events.
   - `teamos_identity_runtime`: Restricted role for session creation and lookup via `SECURITY DEFINER` functions.
3. **Optimistic Concurrency Control (OCC):**
   - Concurrent task modifications require the client to supply `expectedVersion`. Concurrent edits produce `HTTP 409 Conflict`, preventing silent overwrites.
4. **Deterministic Graph Invariants:**
   - Task dependencies are finish-to-start (Blocker must complete before Dependent may start).
   - Dependency edge additions check for cycle creation. Any cycle is rejected prior to committing.
5. **Human Approval for AI Changes:**
   - The AI planning engine produces structured JSON proposals staged as `PENDING`.
   - The model has no write access to project or task tables. Mutations require an explicit diff review and administrative approval.
6. **Constant-Time Webhook Verification:**
   - GitHub webhook payloads are validated using constant-time HMAC-SHA256 comparison over the raw request body buffer.

---

## 7. Local Prerequisites & Setup

### Prerequisites
- **Node.js:** `>= 20.0.0` (LTS recommended)
- **pnpm:** `^9.0.0` or `^10.0.0` (Enable via `corepack enable pnpm`)
- **Docker & Docker Compose:** For running the local PostgreSQL 16 container

### Quickstart Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd PROJECT-K
   ```

2. **Install monorepo dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *(See [Environment Variables](#8-environment-variables) below for details.)*

4. **Start the PostgreSQL database container:**
   ```bash
   docker compose up -d postgres
   ```
   *Wait 5-10 seconds for PostgreSQL to initialize the database, roles, and migration scripts.*

5. **Verify Database Connectivity:**
   ```bash
   docker compose exec postgres pg_isready -U teamos_owner -d teamos
   ```

6. **Run monorepo verification (Typecheck & Tests):**
   ```bash
   pnpm typecheck
   pnpm test
   ```

7. **Build the packages and applications:**
   ```bash
   pnpm build
   ```

8. **Start the development servers:**
   Open three terminal tabs:
   ```bash
   # Terminal 1: Backend API (port 3001)
   pnpm --filter=@teamos/api dev

   # Terminal 2: Web Dashboard (port 3000)
   pnpm --filter=@teamos/web dev

   # Terminal 3: Background Worker
   pnpm --filter=@teamos/worker start
   ```

   Access the web dashboard at: [http://localhost:3000](http://localhost:3000)
   Access the REST API readiness probe at: [http://localhost:3001/api/v1/health/ready](http://localhost:3001/api/v1/health/ready)

---

## 8. Environment Variables

All configuration is managed through environment variables loaded via `.env` (template in `.env.example`). **Never commit `.env` files.**

| Variable | Description | Default / Local Development |
|---|---|---|
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | Backend REST API port | `3001` |
| `CORS_ORIGIN` | Authorized browser origins for CORS and CSRF checks | `http://localhost:3000` |
| `APP_ORIGIN` | Web application origin for OAuth redirects | `http://localhost:3000` |
| `DATABASE_URL_MIGRATION` | DDL connection string for Prisma migrations | `postgresql://teamos_owner:teamos_owner_password@localhost:5432/teamos?schema=public` |
| `DATABASE_URL` | Application runtime connection string (Forced RLS) | `postgresql://teamos_api_role:teamos_api_password@localhost:5432/teamos?schema=public` |
| `DATABASE_URL_WORKER` | Worker connection string for outbox claiming | `postgresql://teamos_worker_role:teamos_worker_password@localhost:5432/teamos?schema=public` |
| `DATABASE_URL_IDENTITY` | Identity connection string for session resolution | `postgresql://teamos_identity_runtime:teamos_identity_password@localhost:5432/teamos?schema=public` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Required for real browser login |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Required for real browser login |
| `GITHUB_CALLBACK_URL` | OAuth authorization callback URL | `http://localhost:3001/api/v1/auth/github/callback` |
| `OAUTH_COOKIE_SECRET` | Cryptographic secret for signing OAuth cookie state | 32+ character random string |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for verifying GitHub App webhooks | Required for live webhook ingestion |
| `GEMINI_API_KEY` | Google Gemini API Key | Optional for local dev (uses Mock LLM provider if unset) |
| `AI_KILL_SWITCH` | Global kill switch to instantly disable all AI calls | `false` |

---

## 9. Common Commands

```bash
# Typecheck across all workspace packages
pnpm typecheck

# Lint across all workspace packages
pnpm lint

# Execute all automated unit and integration tests (232 tests)
pnpm test

# Build all packages and applications for production
pnpm build

# Run database tests specifically (including forced RLS and outbox)
pnpm --filter=@teamos/database test

# Run risk engine tests and benchmarks
pnpm --filter=@teamos/risk-engine test

# Run API integration and evaluation tests
pnpm --filter=@teamos/api test

# Verify backup and restore with RLS validation
./scripts/verify-backup-restore.sh
```

---

## 10. Testing & QA Verification

TeamOS maintains an extensive automated testing suite across database security, risk algorithms, API controllers, and AI prompt regressions:

- **Total Passing Automated Tests:** **232 / 232 passed (100%)**
  - **`@teamos/risk-engine` (35 tests):**
    - DAG validation and cycle prevention (direct 2-node, indirect n-node).
    - Critical Path Method (CPM) forward and backward pass.
    - Forward and backward float/slack calculations.
    - Performance benchmark: Processed 2,000 tasks and 5,000 dependencies in **15.48ms** (< 50ms requirement).
    - Snapshot claim verifier and SHA-256 digest integrity checks.
  - **`@teamos/database` (82 tests):**
    - Multi-tenant PostgreSQL forced RLS under `teamos_api_role`.
    - Cross-tenant access rejection and absent-context fail-closed behavior (0 rows).
    - PostgreSQL 16 partial `SET NULL` foreign key behavior (`assignee_id = NULL` preserves `org_id`).
    - Transactional outbox claim sweeps, lease expirations, retries, and dead-letter queues.
    - AI budget atomic pre-reservation, row locking, and settlement.
    - Evidence-grounded report creation and immutable audit events.
  - **`@teamos/api` (115 tests):**
    - 25-case AI Planning regression evaluation suite (100% schema validity & DAG adherence).
    - GitHub App HMAC-SHA256 signature verification over raw request buffers.
    - GitHub App JWT generation and short-lived installation token exchange.
    - Two-tenant isolation probes and Role-Based Access Control (RBAC).
    - Optimistic concurrency control (`expectedVersion` version validation).
    - Session security and CSRF defense.

### Verification Scopes & Distinctions
- **AI Planning Evaluation:** Automated tests evaluate structured output extraction, prompt injection defense, and Kahn's algorithm cycle validation against deterministic mock provider fixtures. Live Google Gemini generation is validated via API key configuration.
- **GitHub Webhook Evaluation:** Tested with synthetic webhook payloads signed with HMAC-SHA256 against actual controller and service logic. Live event ingestion requires a public reverse proxy (e.g., ngrok) and a registered GitHub App.
- **Browser Automation:** End-to-end verified using Playwright browser automation on `http://localhost:3000` (Kanban management, task creation, finish-to-start DAG visualization, What-If simulation, proposal approval, report generation, audit trail inspection, and mobile viewports 390px–1440px).

For full details, review [docs/TEAM_OS_AUTONOMOUS_QA_REPORT.md](docs/TEAM_OS_AUTONOMOUS_QA_REPORT.md).

---

## 11. Current Limitations

1. **Live Google Gemini API Key:** While TeamOS includes a built-in mock LLM provider for local development and testing, live natural-language generation requires a valid `GEMINI_API_KEY`.
2. **GitHub App Webhook Exposure:** Testing live GitHub webhook deliveries requires configuring a GitHub App with permissions on GitHub.com and exposing the local port `3001` to the internet (e.g., via Cloudflare Tunnels or ngrok).
3. **Single-Region Deployment:** TeamOS is architected as an audited modular monolith for single-region PostgreSQL. Multi-region database replication is outside the initial product scope.

---

## 12. Screenshots

*Screenshots from verified Playwright browser runs are preserved in local testing logs (`.playwright-cli/`):*

| Screen | Description |
|---|---|
| **Topological DAG Visualizer** | Multi-stage column layout showing finish-to-start constraints, visual `🔒 Blocked` badges, and active edge lists. |
| **What-If Simulation Sandbox** | Split-pane interactive scenario modeling calculating hypothetical delivery delays in-memory with zero DB mutations. |
| **Proposed Changes Diff Modal** | Exact visual diff review showing proposed task creations and dependency additions prior to administrative approval. |
| **Evidence-Backed Health Report** | Milestone delivery report citing verified database evidence citations and cryptographic SHA-256 snapshot hash. |
| **Audit Timeline & Diff Viewer** | Append-only security log tracking all state mutations with before/after JSON diffs. |

---

## 13. Roadmap & Contribution Guidance

TeamOS is built with strict modular boundaries to enable incremental evolution:

- [ ] **Jira & Linear Bi-Directional Synchronizers:** Ingest tickets from Jira and Linear into deterministic TeamOS dependency graphs.
- [ ] **Pull Request Milestone Blocking:** Automatic GitHub App checks blocking PR merges when milestone delivery risk exceeds tolerance.
- [ ] **Automated AI Budget Top-Up:** Stripe billing integration for self-service AI budget adjustments.
- [ ] **Interactive Gantt Timeline:** Timeline visualization complementing the topological stage visualizer.

### Contributing
Contributions are welcome. Before opening a pull request:
1. Ensure all packages compile cleanly: `pnpm typecheck`
2. Ensure linter passes: `pnpm lint`
3. Ensure the test suite passes with 100% compliance: `pnpm test`
4. Adhere to the core architectural principles defined in `AGENTS.md`.

---

## 14. License

No license has been selected yet. All rights reserved.
