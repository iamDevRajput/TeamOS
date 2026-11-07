# TeamOS

> **Delivery Risk Intelligence for software teams.**  
> Connects project tasks, dependencies, and GitHub activity to answer:  
> *Will we hit our delivery date, what is blocking it, and what changed?*

---

## 1. Architecture Overview

TeamOS is structured as a modular monolith in a pnpm monorepo:

- **`apps/web`**: Next.js App Router frontend with Tailwind CSS.
- **`apps/api`**: NestJS HTTP REST API providing domain endpoints and webhook receivers.
- **`apps/worker`**: Background worker process consuming asynchronous jobs from PostgreSQL transactional outbox.
- **`packages/contracts`**: Shared TypeScript contracts, DTOs, and event envelopes.
- **`packages/risk-engine`**: Pure deterministic Critical Path Method (CPM) and DAG calculation engine.
- **`packages/database`**: Centralized database access with forced PostgreSQL Row-Level Security (RLS) and `withTenant` wrapper.
- **`packages/config`**: Shared strict TypeScript and linter configurations.

---

## 2. Prerequisites

- **Node.js**: >= `20.0.0` (LTS recommended)
- **pnpm**: `^12.0.0` (Enable via `corepack enable pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL database

---

## 3. Quickstart

### Step 1: Install dependencies
```bash
pnpm install
```

### Step 2: Environment configuration
```bash
cp .env.example .env
```

### Step 3: Start local database
```bash
docker compose up -d postgres
```

### Step 4: Run typecheck and tests
```bash
pnpm -r typecheck
pnpm -r test
```

### Step 5: Build all packages and applications
```bash
pnpm -r build
```

### Step 6: Start local development servers
```bash
# In separate terminal tabs:
pnpm --filter=@teamos/api dev
pnpm --filter=@teamos/web dev
```

The API will be available at [http://localhost:3001](http://localhost:3001) and health check at [http://localhost:3001/health](http://localhost:3001/health).  
The Web frontend will be available at [http://localhost:3000](http://localhost:3000).

---

## 4. Engineering Standards & Documentation

Persistent agent rules and architectural decisions:
- `AGENTS.md`: Persistent engineering rules for AI coding agents.
- `docs/TEAM_OS_PROJECT_BLUEPRINT.md`: Comprehensive product, architecture, security, and roadmap blueprint.
- `docs/TEAM_OS_PROMPT_PACK.md`: Step-by-step implementation prompt sequence.

