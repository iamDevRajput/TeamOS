# TeamOS Design System Specification

> **Version:** 2.0.0
> **Target Framework:** Next.js 14 App Router, Tailwind CSS 3.4, React 18, TypeScript
> **Brand Identity:** TeamOS — Delivery Risk Intelligence for Engineering Teams
> **Visual Direction:** High-density engineering workspace with dark & light themes, inspired by modern developer products (Plane, Linear, Vercel) while staying 100% true to TeamOS deterministic graph analytics.

---

## 1. Design Foundations & Principles

1. **Information Density with Breathability:** High density for task lists, dependency graphs, and risk metrics; clean margins and typography so complex data is scannable at a glance.
2. **Dual-Theme First-Class Citizens:** True dark theme (near-black `#0d0f12` canvas with layered slate surfaces) alongside a crisp, neutral light theme (`#f8fafc`). Both themes share semantic token names and meet WCAG 2.2 AA contrast standards.
3. **Deterministic Color Semantics:** Color is never purely decorative. Blue/Cyan signifies interactive actions; Emerald indicates on-track/low delivery risk; Amber warns of slippage/medium risk; Rose signals critical blockers/critical path risks; Purple denotes AI proposals.
4. **Normalized Geometry:** Strictly reject non-standard token extractions (e.g., `153.41px` or `16777200px`). All geometry adheres to an 8-point base grid with 4px sub-units.

---

## 2. Spacing & Sizing Scale

All layout dimensions, paddings, and gaps derive from a standardized 4px/8px modular scale:

| Token | Pixels | Rem | Typical Usage |
| :--- | :--- | :--- | :--- |
| `space.1` | `4px` | `0.25rem` | Badge gaps, micro-icon margins |
| `space.2` | `8px` | `0.5rem` | Button padding-y, input padding-y, tag gaps |
| `space.3` | `12px` | `0.75rem` | Button padding-x, list item padding-y |
| `space.4` | `16px` | `1.0rem` | Card padding, dropdown padding, standard gutter |
| `space.5` | `20px` | `1.25rem` | Modal sub-headers, sidebar section padding |
| `space.6` | `24px` | `1.5rem` | Panel headers, table cell padding |
| `space.8` | `32px` | `2.0rem` | Section vertical rhythm, drawer margins |
| `space.10` | `40px` | `2.5rem` | Page section dividers, major layout gutters |
| `space.12` | `48px` | `3.0rem` | Top header height (`h-12`), empty state padding |
| `space.14` | `56px` | `3.5rem` | Global navigation rail width (`w-14`) |
| `space.60` | `240px` | `15.0rem` | Collapsible sidebar width (`w-60`) |

*Note on Error Normalization:* The raw extracted value `space.7 = 153.41px` has been rejected as an anomalous layout spacer and normalized to standard layout tokens (`space.10 = 40px` and `space.12 = 48px`).

---

## 3. Radius & Elevation System

### 3.1 Border Radius Tokens
| Token | Pixels | Usage |
| :--- | :--- | :--- |
| `radius.xs` | `4px` | Kbd shortcuts, tiny status tags |
| `radius.sm` | `6px` | Badges, small inputs, buttons |
| `radius.md` | `8px` | Standard buttons, menu items, table rows |
| `radius.lg` | `10px` | Input fields, dropdown popovers |
| `radius.xl` | `12px` | Cards, flyout panels, modals |
| `radius.2xl`| `16px` | Large dialogs, major dashboard containers |
| `radius.full`| `9999px`| User avatars, circular pills, toggle handles |

*Note on Error Normalization:* The raw extracted value `radius.xl = 16777200px` has been rejected and normalized to `radius.xl = 12px` (cards/modals) and `radius.full = 9999px` (pills/avatars).

### 3.2 Shadow & Elevation
- **Level 0 (Flat):** `box-shadow: none` — standard list rows and borders.
- **Level 1 (Card/Input):** `0 1px 2px 0 rgba(0, 0, 0, 0.05)` — interactive cards and active inputs.
- **Level 2 (Dropdown/Popover):** `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)` — workspace switcher, action menus.
- **Level 3 (Modal/Dialog):** `0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)` — full-screen dialogs and command palette.

---

## 4. Semantic Color Tokens & Theme Architecture

The system supports seamless switching between Light and Dark modes via CSS variables scoped to `:root` and `.dark`.

```css
/* Color Token Definitions */
:root {
  /* Light Theme */
  --background: 248 250 252;          /* slate-50 canvas */
  --surface: 255 255 255;             /* pure white cards */
  --surface-secondary: 241 245 249;   /* slate-100 sidebar & table headers */
  --surface-tertiary: 226 232 240;    /* slate-200 hover states */
  --foreground: 15 23 42;             /* slate-900 primary text */
  --foreground-muted: 100 116 139;    /* slate-500 secondary text */
  --foreground-subtle: 148 163 184;   /* slate-400 placeholders & icons */
  --border: 226 232 240;              /* slate-200 subtle borders */
  --border-hover: 203 213 225;        /* slate-300 interactive borders */
  --primary: 37 99 235;               /* blue-600 action primary */
  --primary-hover: 29 78 216;         /* blue-700 action hover */
  --ring: 59 130 246;                 /* blue-500 focus outline */
}

.dark {
  /* Dark Theme (Plane / Developer-Grade) */
  --background: 13 15 18;             /* #0d0f12 near-black canvas */
  --surface: 20 23 28;                /* #14171c cards & work item rows */
  --surface-secondary: 26 30 37;      /* #1a1e25 sidebar & headers */
  --surface-tertiary: 35 41 51;       /* #232933 popovers & elevated surfaces */
  --foreground: 241 245 249;          /* slate-100 high-contrast text */
  --foreground-muted: 148 163 184;    /* slate-400 readable secondary text */
  --foreground-subtle: 100 116 139;   /* slate-500 subdued metadata */
  --border: 39 45 56;                 /* #272d38 discrete dark borders */
  --border-hover: 55 65 81;           /* slate-700 hover borders */
  --primary: 56 189 248;              /* sky-400 / cyan action accent */
  --primary-hover: 14 165 233;        /* sky-500 action hover */
  --ring: 56 189 248;                 /* sky-400 focus outline */
}
```

### Risk & Intelligence Semantic Roles
- **Low Risk / Safe:**
  - Light: text `#059669`, surface `#ecfdf5`, border `#a7f3d0`
  - Dark: text `#34d399`, surface `#064e3b` (30% alpha), border `#059669` (40% alpha)
- **Medium Risk / Warning:**
  - Light: text `#d97706`, surface `#fffbeb`, border `#fde68a`
  - Dark: text `#fbbf24`, surface `#78350f` (30% alpha), border `#d97706` (40% alpha)
- **High Risk / Critical Blocker:**
  - Light: text `#dc2626`, surface `#fef2f2`, border `#fecaca`
  - Dark: text `#f87171`, surface `#7f1d1d` (30% alpha), border `#dc2626` (40% alpha)
- **AI Planning / Proposals:**
  - Light: text `#7c3aed`, surface `#f5f3ff`, border `#ddd6fe`
  - Dark: text `#c084fc`, surface `#581c87` (30% alpha), border `#9333ea` (40% alpha)

---

## 5. Typography Scale

Font stack uses native high-performance system typography:
`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
Monospace for task keys (`DEMO-12`), digests, and code:
`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Style | Size | Line Height | Weight | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display` | `24px` | `32px` | `700` | `-0.025em` | Dashboard titles, project headers |
| `h1` | `20px` | `28px` | `700` | `-0.02em` | View titles, modal titles |
| `h2` | `16px` | `24px` | `600` | `-0.015em` | Section headers, card titles |
| `h3` | `14px` | `20px` | `600` | `-0.01em` | Group headers, table column headers |
| `body` | `13px` | `18px` | `400 / 500`| `-0.01em` | Work item titles, form labels, table cells |
| `caption`| `11px`| `16px` | `500` | `0em` | Metadata, badges, timestamps, shortcuts |
| `mono` | `11px` | `14px` | `600` | `0.02em` | Task keys (`DEMO-14`), SHA digests, commits |

---

## 6. Accessibility & Motion Guidelines

1. **WCAG 2.2 AA Contrast Compliance:** All text-to-background contrast ratios strictly exceed 4.5:1 for normal text and 3:1 for large text.
2. **Non-Color Indicators:** Every status pill and risk indicator combines color with text or an iconography glyph (e.g. Shield for security, AlertCircle for blockers, CheckCircle for complete).
3. **Keyboard Navigability:** Full keyboard access:
   - `⌘K` or `Ctrl+K`: Global command palette & search.
   - `C`: Quick-create task modal.
   - `Escape`: Dismiss open modals, popovers, and drawers.
   - Tab / Shift+Tab: Logical roving tabindex through all interactive controls.
4. **Motion Safety:** Standard transition `150ms cubic-bezier(0.16, 1, 0.3, 1)`. All transitions automatically honor `@media (prefers-reduced-motion: reduce)`.
