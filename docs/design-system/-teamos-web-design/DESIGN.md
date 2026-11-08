# @teamos/web DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: Tailwind CSS 3.4.14 + React 18.3.1 + Next.js 14.2.15
> Colors: 0 · Fonts: 1 · Components: 20
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: subtle

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a neutral, approachable feel. The light background emphasizes content clarity. Typography uses **sans-serif** throughout — a clean, modern choice that maintains consistency. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 10, 12, 14, 16px. Motion is subtle — smooth transitions (150-300ms) ease state changes without drawing attention.

---

## 2. Color Palette & Roles

No colors detected in the project.

---

## 3. Typography Rules

**Font Stack:**
- **sans-serif** — Heading 1, Heading 2, Heading 3, Body, Caption

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | sans-serif | 48px / 3rem | 700 |
| Heading 2 | sans-serif | 32px / 2rem | 600 |
| Heading 3 | sans-serif | 24px / 1.5rem | 600 |
| Body | sans-serif | 16px / 1rem | 400 |
| Caption | sans-serif | 12px / 0.75rem | 400 |

**Typographic Rules:**
- Use **sans-serif** for all text — do not mix font families
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (8)

**AuditTimeline** — `src/components/audit-timeline.tsx`
- Props: `orgId`, `apiBaseUrl`
- Key Styles: `rounded-lg`, `border-slate-200`, `bg-white`, `space-y-4`, `text-base`, `font-semibold`, `shadow-sm`, `focus:outline-none`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Audit Timeline</h3>
          <p className="text-xs text-slate-500">
            Immutable, append-only security log of all sensitive organizational state mutations.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600">Filter:</label>
          <select
```

**DependencyGraph** — `src/components/dependency-graph.tsx`
- Props: `orgId`, `projectId`, `projectKey`, `apiBaseUrl`, `onSelectTask`, `taskId`, `refreshKey`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-white`, `p-8`, `text-xs`, `font-bold`, `shadow-sm`
- Animation: tw-animate-spin, tw-transitions: transition-all
- State: useState

```tsx
<div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500">Computing graph topology & dependencies...</p>
      </div>
```

**ProjectsPanel** — `src/components/projects-panel.tsx`
- Variants: `tasks`, `dependencies`, `risk`, `proposals`, `reports`
- Props: `orgId`, `members`, `currentUserRole`, `apiBaseUrl`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-white`, `space-y-6`, `text-xs`, `font-bold`, `shadow-sm`, `hover:bg-slate-200`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="space-y-6">
      {/* Project Selector & Actions Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 overflow-x-auto max-w-full">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Projects:
          </span>
          {projects.map((p
```

**ProposalDetailModal** — `src/components/proposal-detail-modal.tsx`
- Variants: `OWNER`, `user`
- Props: `isOpen`, `onClose`, `proposal`, `orgId`, `projectKey`, `currentUserRole`, `apiBaseUrl`, `onUpdated`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-xs`, `font-mono`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  proposal.state === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : proposal.state === 'REJECTED'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
```

**ProposalsPanel** — `src/components/proposals-panel.tsx`
- Variants: `user`
- Props: `orgId`, `projectId`, `projectKey`, `tasks`, `currentUserRole`, `apiBaseUrl`, `refreshKey`, `onProposalApplied`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-white`, `space-y-4`, `text-base`, `font-bold`, `shadow-sm`, `hover:bg-purple-100`
- Animation: tw-transitions: transition-colors, transition-shadow, hover-transforms
- State: useState

```tsx
<div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Project Proposals & Plans
            </h3>
            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              Human Review & Concurrency Checked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
```

**ReportDetailModal** — `src/components/report-detail-modal.tsx`
- Variants: `system`, `Undefined`, `None`
- Props: `report`, `onClose`
- Key Styles: `rounded-2xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-mono`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-animate-in, tw-transitions: duration-200, transition-colors

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${riskBadge}`}>
                {report.deliveryRisk} RISK
              </span>
              <span className="font-mono text-[11px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                Hash: {report.snapshotHash.slice(0, 8
```

**ReportsPanel** — `src/components/reports-panel.tsx`
- Props: `orgId`, `projectId`, `apiBaseUrl`
- Key Styles: `rounded-2xl`, `border-slate-200`, `bg-white`, `space-y-6`, `text-base`, `font-bold`, `shadow-xs`, `hover:bg-blue-700`
- Animation: tw-transitions: transition-colors, transition-all, hover-transforms
- State: useState

```tsx
<div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">Evidence-Backed Health Reports</h3>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              Phase I Ground Truth
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Authoritative delivery reports compiled from deterministic CPM graph calculations and immutable task snapshots. All claims cite verified entity citations.
```

**RiskOverviewPanel** — `src/components/risk-overview-panel.tsx`
- Variants: `Unknown`
- Props: `orgId`, `projectId`, `projectKey`, `tasks`, `apiBaseUrl`, `refreshKey`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-white`, `p-8`, `text-xs`, `font-black`, `shadow-sm`
- Animation: tw-animate-spin, tw-transitions: transition-colors
- State: useState

```tsx
<div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-xs text-slate-500">Calculating Critical Path Method & Delivery Risk...</p>
      </div>
```

### Navigation (1)

**Navbar** — `src/components/navbar.tsx`
- Props: `sessionData`, `orgs`, `activeOrg`, `onSelectOrg`, `org`, `onOpenCreateOrg`, `onLogout`
- Key Styles: `rounded-lg`, `border-slate-200`, `bg-white/80`, `mx-auto`, `text-lg`, `font-black`, `backdrop-blur-md`, `hover:bg-slate-100`
- Animation: tw-transitions: transition-colors
- State: useState, useRef

### Data Display (3)

**InvitationsPanel** — `src/components/invitations-panel.tsx`
- Props: `orgId`, `apiBaseUrl`, `onOpenInviteModal`, `refreshKey`
- Key Styles: `rounded-lg`, `border-rose-200`, `bg-blue-600`, `space-y-4`, `text-base`, `font-semibold`, `shadow-sm`, `hover:bg-blue-700`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Pending Invitations</h3>
          <p className="text-xs text-slate-500">
            Shareable invitations that have not yet been accepted or expired.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenInviteModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
```

**MembersTable** — `src/components/members-table.tsx`
- Props: `orgId`, `members`, `currentUserRole`, `currentUserId`, `apiBaseUrl`, `onMemberUpdated`, `onOpenTransferModal`
- Key Styles: `rounded-lg`, `border-rose-200`, `bg-rose-50`, `space-y-4`, `text-xs`, `font-semibold`, `hover:bg-slate-50/70`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="space-y-4">
      {actionError && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {actionError}
        </div>
```

**TaskBoard** — `src/components/task-board.tsx`
- Variants: `board`, `table`
- Props: `tasks`, `projectKey`, `onSelectTask`, `task`, `onQuickStatusChange`, `taskId`, `newStatus`, `version` (+1 more)
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-white`, `space-y-4`, `text-xs`, `font-semibold`, `shadow-sm`, `focus:outline-none`
- Animation: tw-transitions: transition-colors, transition-shadow
- State: useState

```tsx
<div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={search}
            onChange={(e
```

### Data Input (8)

**AiPlanGeneratorModal** — `src/components/ai-plan-generator-modal.tsx`
- Props: `isOpen`, `onClose`, `orgId`, `projectId`, `projectKey`, `apiBaseUrl`, `onPlanGenerated`, `proposal`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-xl`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-animate-spin, tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                AI Plan Generator
              </h3>
              <p className="text-xs text-slate-500">
                Convert an engineering brief into a structured, DAG-verified plan proposal.
              </p>
```

**CreateOrgModal** — `src/components/create-org-modal.tsx`
- Props: `isOpen`, `onClose`, `onSuccess`, `org`, `apiBaseUrl`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Create New Organization</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>
```

**CreateProjectModal** — `src/components/create-project-modal.tsx`
- Props: `isOpen`, `onClose`, `orgId`, `apiBaseUrl`, `onSuccess`, `project`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>
```

**CreateProposalModal** — `src/components/create-proposal-modal.tsx`
- Props: `isOpen`, `onClose`, `orgId`, `projectId`, `projectKey`, `tasks`, `apiBaseUrl`, `onSuccess`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-base`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Submit Change Proposal</h3>
            <p className="text-xs text-slate-500">
              Propose a plan of tasks and dependencies for project {projectKey}. Requires admin review.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
```

**CreateTaskModal** — `src/components/create-task-modal.tsx`
- Props: `isOpen`, `onClose`, `orgId`, `projectId`, `projectKey`, `members`, `apiBaseUrl`, `onSuccess` (+1 more)
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Task</h2>
            <p className="text-xs text-slate-400">Project: {projectKey}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
```

**InviteModal** — `src/components/invite-modal.tsx`
- Variants: `MEMBER`, `ADMIN`
- Props: `isOpen`, `onClose`, `orgId`, `apiBaseUrl`, `onSuccess`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {createdInvite ? 'Invitation Created' : 'Invite Teammate'}
          </h2>
          <button
            onClick={handleResetAndClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
```

**TaskDetailModal** — `src/components/task-detail-modal.tsx`
- Props: `isOpen`, `onClose`, `task`, `allTasks`, `projectKey`, `orgId`, `members`, `apiBaseUrl` (+1 more)
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-xs`, `font-mono`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-animate-spin, tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              {projectKey}-{task.number}
            </span>
            <span className="text-xs text-slate-400">Version: {task.version}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
```

**TransferOwnershipModal** — `src/components/transfer-ownership-modal.tsx`
- Props: `isOpen`, `onClose`, `orgId`, `members`, `currentUserId`, `apiBaseUrl`, `onSuccess`
- Key Styles: `rounded-xl`, `border-slate-200`, `bg-slate-900/50`, `p-4`, `text-lg`, `font-bold`, `backdrop-blur-sm`, `hover:text-slate-600`
- Animation: tw-transitions: transition-colors
- State: useState

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-rose-700">Transfer Organization Ownership</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>
```



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32
- **Border radius:** 4px, 8px, 12px, 16px
- **Grid usage:** `grid-cols-1`, `grid-cols-2`
- **Container:** Tailwind `container` class with responsive padding

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

No box-shadow values detected. The design appears to use a flat visual style.


---

## 7. Animation & Motion

This project uses **subtle motion**. Transitions smooth state changes without demanding attention.

### CSS Animations

- `@keyframes animate-spin`
- `@keyframes animate-in`

### Animated Components

- **AiPlanGeneratorModal**: tw-animate-spin, tw-transitions: transition-colors
- **AuditTimeline**: tw-transitions: transition-colors
- **CreateOrgModal**: tw-transitions: transition-colors
- **CreateProjectModal**: tw-transitions: transition-colors
- **CreateProposalModal**: tw-transitions: transition-colors

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use **sans-serif** for all UI text
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use border and background shifts for elevation — not shadows
- Use border-radius from the scale: 4px, 8px, 12px, 16px
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't mix font families — use sans-serif consistently
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't add box-shadow — this design system uses flat elevation
- Don't use gradients — the design uses solid colors only
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first

### Anti-Patterns (detected from codebase)

- No box-shadow on any element
- No gradient backgrounds
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| sm | 640px | tailwind |
| md | 768px | tailwind |
| lg | 1024px | tailwind |
| xl | 1280px | tailwind |
| 2xl | 1536px | tailwind |

**Approach:** Mobile-first using Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`).
Always design for mobile first, then layer on responsive overrides.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: var(--surface)
Border: 1px solid var(--border)
Radius: 12px
Padding: 16px
Font: sans-serif
No shadows — use borders and surface colors for depth.
```

### Build a Button

```
Primary: bg var(--accent), text white
Ghost: bg transparent, border var(--border)
Padding: 8px 16px
Radius: 12px
Hover: opacity 0.9 or lighter shade
Focus: ring with var(--accent)
```

### Build a Page Layout

```
Background: var(--background)
Max-width: 1280px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: var(--surface)
Label: var(--text-muted) (muted, 12px, uppercase)
Value: var(--text-primary) (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: var(--background)
Input border: 1px solid var(--border)
Focus: border-color var(--accent)
Label: var(--text-muted) 12px
Spacing: 16px between fields
Radius: 12px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: sans-serif, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: flat, surface shifts
```
