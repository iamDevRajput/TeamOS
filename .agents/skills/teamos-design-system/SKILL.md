---
name: teamos-design-system
description: TeamOS engineering design system and UI component conventions. Enforces high information density, dual dark/light themes, normalized spacing/radius scales, and deterministic risk color semantics.
metadata:
  version: "2.0.0"
  framework: "Next.js 14 + Tailwind CSS + React 18"
---

# TeamOS Design System — Local Engineering Skill

Use this skill when designing, building, or refining user interface components in TeamOS.

## Core Directives
1. **Always support both Dark (`.dark`) and Light themes.** Never use hardcoded light-only colors like `bg-white` or `text-slate-900` without corresponding `dark:` classes or semantic CSS variables (`bg-surface`, `text-foreground`).
2. **Follow Normalized Scales:**
   - Spacing: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px. Never introduce irregular values like `153.41px`.
   - Radius: `rounded-sm` (6px), `rounded-md` (8px), `rounded-lg` (10px), `rounded-xl` (12px), `rounded-full` (9999px). Never use anomalous `16777200px`.
3. **Information Density:**
   - Work item rows: compact ~36px height with scannable typography, status dot, priority pill, due date, assignee avatar, and dependency link count.
4. **Deterministic Colors:**
   - Blue/Cyan: Interactive elements, selections, links.
   - Emerald: Low Risk, Completed tasks, Healthy delivery dates.
   - Amber: Medium Risk, In Progress tasks, Warning states.
   - Rose: High Risk, Critical path tasks, Blocked items.
   - Purple: AI Planning, Proposals, Automated suggestions.
5. **Accessibility:**
   - Ensure WCAG 2.2 AA contrast in both themes.
   - Never communicate state with color alone; always pair with a label or icon.
   - Maintain visible focus rings (`:focus-visible`).
