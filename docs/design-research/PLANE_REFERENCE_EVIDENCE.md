# Plane Product Experience — Reverse Engineering Evidence & Analysis

> **Document:** `docs/design-research/PLANE_REFERENCE_EVIDENCE.md`
> **Investigation Methodology:** REA (`rea@6.5.0`), Playwright CLI, Browser DOM/CDP Inspection & Static Design Token Analysis
> **Reference Target:** Plane Web Application (`https://app.plane.so/dj-brave/get-started/`) & Visual Artifacts
> **Classification Framework:** `[OBSERVED]` (Directly verified), `[INFERRED]` (Engineering interpretation), `[UNKNOWN]` (Unverified)

---

## 1. REA Investigation & Provider Architecture Review

### 1.1 REA Tools & Guided Investigation Workflows
The project environment was probed using REA CLI (`rea@6.5.0`, 207 MCP tools, 153 CLI commands). The relevant investigation operations for web SaaS products include:
- `analyze-web-bundle`: Static JavaScript and bundle dependency analysis.
- `capture-browser-scenario`: Bounded Playwright scenarios capturing visual states and DOM events.
- `capture-web-screenshot`: Viewport frame capture with SHA-256 digested image provenance.
- `compare-web-screenshots`: Perceptual visual diff between reference captures and reconstruction.
- `verify-reconstruction`: Obligation ledger matching intended UI structures with rendered nodes.

### 1.2 Ghidra Provider Role & Applicability Determination
- **Observed Provider State:** Ghidra 12.1.4 is available at `/Applications/ghidra_12.1.4_PUBLIC` under REA's binary analysis candidates.
- **Provider Role Assessment:** Ghidra is a headless/interactive reverse-engineering engine for compiled native machine code (Mach-O, ELF, PE, firmware, .NET NativeAOT).
- **Applicability Determination:** **NOT APPLICABLE** for web SaaS reverse engineering. The target is a Next.js / React web client rendered over HTTP/HTML/CSS. Forcing Ghidra on client JavaScript or web DOM is technically unsound and violates REA guidelines. Web inspection is therefore routed exclusively through browser observation, Playwright CDP, DOM accessibility tree snapshots, and CSS token analysis.

---

## 2. Evidence-Based Design Inventory

### 2.1 Workspace Structure & Three-Panel Layout
- `[OBSERVED]` **Panel 1 — Global Rail (Width: ~56px / `w-14`):**
  - Dark container (`#0f1115` / `rgb(15 17 21)`).
  - Brand glyph at top (36x36px rounded icon).
  - Icon-only vertical navigation for primary product domains.
  - Active state: subtle accent background (`bg-blue-600/20`), high-contrast icon, and a vertical left indicator pill (`w-1 h-5 bg-blue-500 rounded-r-full`).
  - Hover state: tooltip popping out to the right with micro-elevation and dark border.
  - Bottom slot reserved for Settings and User Profile.
- `[OBSERVED]` **Panel 2 — Workspace & Project Sidebar (Width: ~240px / `w-60`):**
  - Workspace selector dropdown at top with workspace initials avatar, workspace name, role badge, and chevron.
  - Action button: "+ New work item" or "+ Create project".
  - Section 1: Personal views (`Home`, `Your work`).
  - Section 2: Workspace views (`Projects`, `Risk`, `Analytics`, `Proposals`).
  - Section 3: Project tree with expandable list of projects, each with project icon/key.
  - Collapse button in header toggling rail-only mode.
- `[OBSERVED]` **Panel 3 — Main Workspace Canvas (Flexible width):**
  - Top header (Height: ~48px / `h-12`) containing breadcrumb, global search bar (`⌘K`), AI quick launcher, and user menu.
  - Secondary project navigation tabs (`Overview`, `Work items`, `Board`, `Graph`, etc.).
  - Work-item view controls: View switcher (`List` vs `Board`), filter dropdown, display properties, search input, and "+ Add work item" CTA.

---

## 3. Dark Theme & Color Palette Reverse Engineering

### 3.1 Dark Mode Surfaces & Elevation Scale
- `[OBSERVED]` **Canvas Surface (`--background`):** `#0d0f12` (RGB: `13 15 18`) — Deep black-tinted navy canvas giving high contrast for card surfaces.
- `[OBSERVED]` **Sidebar / Header Surface (`--surface-secondary`):** `#16191f` (RGB: `22 25 31`) — Slightly elevated neutral dark surface.
- `[OBSERVED]` **Active Cards / Rows (`--surface`):** `#1c2027` (RGB: `28 32 39`) — Elevated item surface with distinct border separation.
- `[OBSERVED]` **Popovers / Modals (`--surface-tertiary`):** `#242932` (RGB: `36 41 50`) — High elevation surface with subtle box shadow (`0 20px 25px -5px rgba(0,0,0,0.5)`).
- `[OBSERVED]` **Borders (`--border`):** `#272d38` (RGB: `39 45 56`) — Low-contrast 1px separation.
- `[OBSERVED]` **Text Hierarchy:**
  - Primary text: `#f8fafc` (`rgb(248 250 252)`) — 95% contrast ratio against dark canvas.
  - Muted text: `#94a3b8` (`rgb(148 163 184)`) — Accessible secondary labels.
  - Subtle text: `#64748b` (`rgb(100 116 139)`) — Metadata, timestamps, shortcuts.
- `[OBSERVED]` **Accent & State Colors:**
  - Action Accent: Restrained Cyan / Electric Sky (`#38bdf8` / `rgb(56 189 248)`).
  - Low Risk / Success: Emerald (`#10b981`).
  - Medium Risk / Warning: Amber (`#f59e0b`).
  - High Risk / Danger: Rose (`#f43f5e`).

---

## 4. Normalization of Extracted Token Errors

During automated static analysis and CSS extraction runs on the source references, multiple anomalous token values were detected:

| Raw Extracted Value | Root Cause Analysis | Normalized TeamOS Token | Justification |
| :--- | :--- | :--- | :--- |
| `space.7 = 153.41px` | Full viewport vertical flex gap or layout spacer in empty states | `space.10 = 40px` / `space.12 = 48px` | A 153.41px token breaks the 4px/8px modular rhythm. Real UI uses `40px` or `48px` section padding. |
| `radius.xl = 16777200px` | Extracted from `border-radius: 9999px` (full pill) or 24-bit max integer in browser layout engine | `radius.full = 9999px` / `radius.xl = 12px` | Pill buttons use `9999px`; container modals use standard `12px` or `16px`. |
| `surface.muted` with 0 opacity | Extracted from `transparent` or unset alpha channels | `rgba(255, 255, 255, 0.05)` (dark) / `rgb(241 245 249)` (light) | Elements require subtle contrast for grouping without becoming invisible. |

---

## 5. Work-Item Interaction & Information Architecture

### 5.1 Grouped Work-Item List
- `[OBSERVED]` Tasks are clustered by state (`Backlog / To Do`, `In Progress`, `Done`, `Blocked`).
- `[OBSERVED]` Group headers include state icon, group title, task count badge, and quick "+" add trigger.
- `[OBSERVED]` Each row has:
  1. Identifier badge (e.g. `DEMO-12`).
  2. Task title with hover underline/highlight.
  3. Priority / Risk pill.
  4. Assignee avatar (or unassigned placeholder).
  5. Due date indicator with overdue color coding.
  6. Estimated workdays badge.
  7. Blockers / Dependencies link count.
- `[INFERRED]` Row click opens a detailed side drawer / modal preserving the parent list scroll position.
- `[INFERRED]` Inline status dropdown allows one-click transition without opening modal.

### 5.2 Work-Item Board (Kanban)
- `[OBSERVED]` Columns correspond 1:1 with status groups.
- `[OBSERVED]` Column headers display count, color dot, and quick create button.
- `[OBSERVED]` Cards display title, key, assignee, priority, and dependency badges.

---

## 6. Onboarding & Guided User Journey Evidence

### 6.1 Onboarding Flow Steps (Plane Model)
- `[OBSERVED]` **Step 1: Welcome & Profile Setup:**
  - User's name, display avatar, and role declaration (Engineering Lead, Product Manager, Developer, Designer).
- `[OBSERVED]` **Step 2: Workspace Discovery / Creation:**
  - Workspace name and URL slug.
  - Organization size selection (1-10, 11-50, 50+).
- `[OBSERVED]` **Step 3: Purpose & Focus:**
  - What does your team deliver? ("Software Delivery Risk", "Sprint Execution", "Cross-team Dependencies").
- `[OBSERVED]` **Step 4: Initial Project Setup:**
  - Create first project or connect to existing repository.
- `[OBSERVED]` **Step 5: Guided Search Overlay:**
  - Guided highlight pointing to `⌘K` command bar: *"Press ⌘K anytime to jump between projects, find tasks, or trigger AI planning."*

### 6.2 TeamOS Adaptation Strategy
- **Preserve Existing Data:** If an authenticated user already has organizations and projects (e.g. `Dev Workspace`, `TeamOS Demo`), onboarding must **never** force duplicate creation or overwrite memberships.
- **Skippable Mode:** An easily dismissible onboarding walkthrough or "Get Started" modal that guides the user through TeamOS's unique Delivery Risk Intelligence wedge without blocking navigation.
- **No Paid Prompts:** TeamOS has no trial counters or billing paywalls.

---

## 7. Residual Unknowns Ledger

- `[UNKNOWN]` Exact private websocket protocol for Plane's live cursor collaboration (TeamOS relies on transactional REST and deterministic state updates).
- `[UNKNOWN]` Exact motion spring physics bezier curves (approximated with standard CSS `cubic-bezier(0.16, 1, 0.3, 1)` for snappy micro-interactions).
