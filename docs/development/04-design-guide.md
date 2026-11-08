# Linker Design Guide

> Question this document answers: **Which colors, type sizes, spacing, shapes and component looks does Linker use, and how are they written in CSS?**
> Structure and code rules are in [03 Frontend Blueprint](03-frontend-blueprint.md); this document only covers how things look. Token values live in code at `frontend/apps/web/styles/tokens/` (`color.css`, `typography.css`, `layout.css`). If this document and the token files disagree, fix them together in the same change.
>
> `MUST` and `NEVER` are followed without exception. `RECOMMENDED` needs judgment.

> **Path conventions:** frontend code paths such as `apps/web/` are relative to `frontend/`; explicit `frontend/` paths are relative to the repository root.

## 0. Rules at a glance

1. **Visual authority (conflict order):** **① the page’s Figma frame** → **② `styles/tokens/`** (if Figma differs, update the token first, then use it) → **③ this guide’s recipes**. **NEVER** invent tablet/desktop layout variants that are not in Figma. The old Mobbin-based look is **retired** as an authority (see ch. 6).
2. **MUST** style with CSS Modules (`*.module.css` next to the component) and read every color, size, space and radius through `var(--token)`. **NEVER** write a hex color, a font size or a radius as a raw value in a component.
3. **MUST NOT** add a new color, font size or radius in a component. Add the token first (token file + this guide), then use it.
4. **App screens = mobile column only.** Design and implement for **360–600px**. Below 600px the column is full width; **above 600px** the app column is **`max-width: var(--content-max-width)` (600px), centered**, with `--color-canvas-outside` (dark) showing outside it. **NEVER** add a separate tablet/desktop app layout. Ops / admin (pages 25–27) is a separate, desktop-only tool with its own shell (ch. 3-1, 6-6) — it has no mobile layout, keeps `--color-canvas`, and sits outside this rule entirely.
5. Header and bottom tab bar live **inside the same 600px column** as the page (not full-bleed across a wide browser).
6. Source order when token roles conflict: **text color and type** (ch. 2) over **palette** (ch. 1) over **everything else** (ch. 3–5). Text on a white surface uses the `--color-text-*` tokens only.
7. Shadow-free. Depth comes from fill differences and 1px hairlines (ch. 4). The only shadow token is `--shadow-segment-active`.
8. Never signal state by color alone. Pair color with text, an icon or a border (WCAG 1.4.1).
9. No hover-only UI. Input/textarea font **≥ 16px** (iOS zoom). Prefer `100dvh` and `viewportFit: cover`.
10. **Scrollbars stay visually hidden; scroll itself stays enabled** (ch. 3-5). **NEVER** block scrolling with a global `overflow: hidden` on `html`/`body`. Nested horizontal + vertical UIs (e.g. kanban) must keep swipe axes independent in iOS/Android WebView.
11. **Icons = Solar Icons first** (`@solar-icons/static` / `@solar-icons/react`). **MUST** use Solar Icons for UI glyphs. **NEVER** treat Lucide (`lucide-react`) or another set as the preferred default.

## 1. Color

Tokens in `tokens/color.css`. Surface is white (`--color-canvas`) unless noted; contrast is measured against it.

### 1-1. Surface, brand, border

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#141414` | Primary CTA fill, footer band, focus ring |
| `--color-on-primary` | `#ffffff` | Text and icons on `--color-primary` (18.4:1) |
| `--color-accent` | `#0066ff` | Popular/new badges, savings emphasis. **NEVER** a CTA fill |
| `--color-gnb-current` | `#2563eb` | Active bottom GNB label/icon on the gray pill (4.65:1 on `--color-canvas-soft`) |
| `--color-gnb-inactive` | `#b2b7c3` | Inactive bottom GNB label/icon (1.81:1 on `--color-canvas-soft` — below AA text contrast; accepted because every tab keeps an icon + label, and the active tab's `--color-gnb-current` carries the real affordance, not color alone) |
| `--color-canvas` | `#ffffff` | Page and card background |
| `--color-canvas-outside` | `#0c0c0c` | `body` background outside the 600px app column on wide browsers (Figma 472:415); AdminShell overrides back to `--color-canvas` |
| `--color-canvas-soft` | `#f3f3f3` | Nav pill, featured card, accordion row, toggle track, soft pill |
| `--color-field` | `#f0f0f0` | Input fill |
| `--color-header-bg` | `rgb(255 255 255 / 0.8)` | Sticky header / open search panel frosted fill, with `--blur-chrome` (`--blur-header-open` when the panel is down) |
| `--color-gnb-bg` | `rgb(243 243 243 / 0.8)` | Bottom GNB pill frosted fill, with `--blur-chrome` |
| `--color-hairline-soft` | `#f0f0f0` | 1px outline of cards on white |
| `--color-hairline` | `#e0e0e0` | Outline buttons and interactive control borders |
| `--color-scrim` | `rgb(20 20 20 / 0.5)` | Behind bottom sheets, dialogs, drawers |
| `--color-canvas-cool` | `#f3f4f6` | Page 07 compact link fill |
| `--color-hairline-cool` | `#e5e7eb` | Page 07 issue rows and selected-team card |
| `--color-hairline-faint` | `#f5f5f5` | Page 07 sheet option divider |
| `--color-selection` | `#2563eb` | Page 07 sheet selected radio |
| `--color-scrim-team-picker` | `rgb(25 31 40 / 0.32)` | Page 07 sheet scrim (Figma `#191f28` 32%), with `--blur-scrim`. Other overlays keep `--color-scrim` |
| `--color-radio-surface` / `--color-radio-border` | `#f6f7fb` / `#eaeaea` | Page 07 sheet radio fill and unselected outline |
| `--color-sheet-cta` / `--color-on-sheet-cta` | `#121212` / `#f8f9f6` | Page 07 sheet CTA fill and label |
| `--color-chip-format-bg` | `rgb(37 99 235 / 0.1)` | Page 19 recruit card format chip (온라인/오프라인/하이브리드), fixed regardless of the value |
| `--color-chip-goal-bg` | `rgb(35 193 4 / 0.15)` | Page 19 recruit card goal chip (공모전/해커톤/출시/학습), fixed regardless of the value |
| `--color-tab-divider` | `#ebebeb` | Page 19 inactive tab underline and the scroll-revealed search panel's bottom border (Figma) |
| `--color-fab-bg` | `#2e2e2e` | Page 19 write-recruit-post FAB fill (Figma) |
| `--color-search-panel-bg` | `#f7f7f7` | Page 19 scroll-revealed search panel background, area B (Figma) |
| `--color-tab-indicator` / `--color-hairline-tab` | `#121212` / `#ebebeb` | Team tabs of 11–15 and 09 (Figma 11): current tab 2px underline / other tabs 1px underline |
| `--color-chart-grid` | `#e5e7eb` | Page 11 trend chart dashed day lines |
| `--color-fab` | `#2e2e2e` | Page 11 team chat shortcut fill |
| `--color-fab-border` | `#383838` | Shared FAB stroke for page 11 team-chat and page 19 write-recruit |
| `--color-board-column` / `--color-board-card-border` | `#f5f5f5` / `#ecedf2` | Page 14 column fill / card outline (Figma 200:1028) |
| `--color-board-control` / `--color-board-control-active` / `--color-board-menu-border` | `#f2f2f2` / `#2563eb` / `#e4e4e4` | Page 14 "필터"·"최신순" buttons and menus; blue while a menu is open or a value is set (white text 5.17:1) |
| `--color-board-label-blue` / `--color-board-label-purple` | `#ebf7ff` / `#f4ebff` | Page 14 card labels, alternating (Figma uses fixed fills, not the GitHub label color) |

`--color-field` and `--color-hairline-soft` share a value but keep separate tokens because they play different roles. Same for `--color-primary` / `--color-text-*`.

### 1-2. Text

| Token | Value | Use | Type level (ch. 2) |
| --- | --- | --- | --- |
| `--color-text-heading` | `#171717` | Page and section headers | Page title, section title |
| `--color-text-title` | `#262626` | Card, post, item titles | Card title |
| `--color-text-body` | `#404040` | Body text, entered values | Body |
| `--color-text-secondary` | `#525252` | Helper text needed to understand the content | Caption |
| `--color-text-placeholder` | `#737373` | Hint before input (white surface only) | Body |
| `--color-text-meta` | `#737373` | Time, view count, source. **NEVER** for required guidance | Meta |
| `--color-text-subtle-on-tint` | `#666666` | Placeholder and meta on `--color-canvas-soft` or `--color-field` | Body / Meta |
| `--color-text-inverse` | `#ffffff` | Text on `--color-primary` surfaces | any |
| `--color-text-inverse-secondary` | `#adadad` | Footer links, fine print on `--color-primary` (8.2:1) | Caption / Meta |
| `--color-status-error` | `#b91c1c` | Input error, failed action; also delete, leave, other irreversible actions | Caption or larger |
| `--color-status-success` | `#15803d` | Saved, registered, verified | Caption or larger |
| `--color-status-warning` | `#92400e` | Loss or expiry warning before it happens | Caption or larger |
| `--color-board-status-blue` … `-yellow` | GitHub Projects Status option enum colors (BLUE/GRAY/GREEN/ORANGE/PINK/PURPLE/RED/YELLOW) | Issue status chips/dots/columns on 07·11–15. SoT is `board_status_mappings.color` via API `statusColor`. **NEVER** color alone — always pair with the status name | Dot / chip accent |
| `--color-text-black` | `#000000` | Page 07 section labels | Body |
| `--color-text-sheet-title` | `#111827` | Page 07 sheet title, selected option | Card title / Caption |
| `--color-text-slate` | `#4b5563` | Page 07 issue title, due date, compact link | Caption |
| `--color-text-muted-cool` | `#98a3b4` | Page 07 issue meta. Low contrast, see §1-3 | Micro |
| `--color-text-unselected` | `#b0b8c1` | Page 07 unselected sheet option. Low contrast, see §1-3 | Caption |
| `--color-status-overdue` | `#e62e00` | Overdue due date on the issue rows of 07 and 11: the date alone in this color, no "마감 지남" text (07 decision). Low contrast, see §1-3 | Caption |
| `--color-text-placeholder-search` | `#a3a3a8` | Page 19 scroll-revealed search input placeholder. Low contrast, see §1-3 | Caption |
| `--color-text-title-cool` | `#111827` | Page 11 section titles, current team tab, search text | Card title / Caption |
| `--color-text-placeholder-cool` | `#a3a3a8` | Page 11 search placeholder on `#f3f4f6`. Low contrast, see §1-3 | Body |
| `--color-progress-done` / `-active` / `-blocked` | `#158000` / `#007be6` / `#e62e00` | Page 11 status card counts and trend lines, always with the status word. `-active`, `-blocked` low contrast, see §1-3 | Caption |

How the palette's text names map here (the palette's own text colors are **not** tokens):

| Palette name | Becomes |
| --- | --- |
| Ink `#141414` (text) | `--color-text-heading` / `-title` / `-body` by role |
| Soft Ink `#262626` | `--color-text-title` |
| Muted `#707070` | `--color-text-meta` (white) or `--color-text-subtle-on-tint` (tint) |
| Faint `#adadad` | `--color-text-inverse-secondary` (dark surface only) |

### 1-3. Contrast rules (WCAG 2.2 AA, 4.5:1 for text)

Measured ratios, so nobody has to recompute:

| Text | Surface | Ratio | Verdict |
| --- | --- | --- | --- |
| `#737373` placeholder/meta | white | 4.74 | pass |
| `#737373` | `#f0f0f0` field / `#f3f3f3` soft | 4.16 / 4.27 | **fail** → use `--color-text-subtle-on-tint` |
| `#666666` subtle-on-tint | `#f0f0f0` / `#f3f3f3` | 5.04 / 5.17 | pass |
| `#adadad` (palette "Faint") | white | 2.24 | **fail** → never on a light surface |
| `#adadad` inverse-secondary | `#141414` | 8.21 | pass |
| `#0066ff` accent text | white / `#f3f3f3` | 4.83 / 4.36 | accent text only on white |
| `#2563eb` GNB current text | `#f3f3f3` | 4.65 | pass; use `--color-gnb-current` for the active tab |
| `#b2b7c3` GNB inactive text | `#f3f3f3` | 1.81 | **fail** by itself — accepted only because every tab always shows an icon + label, never color alone |
| `#ffffff` on accent badge | `#0066ff` | 4.83 | pass |
| `#4b5563` slate | white / `#f3f4f6` | 7.56 / 6.87 | pass |
| `#e62e00` overdue | white | 4.42 | **below 4.5**, Figma value kept (team decision, page 07) |
| `#98a3b4` muted-cool | white | 2.55 | **below 4.5**, Figma value kept (team decision, page 07) |
| `#b0b8c1` unselected | white | 2.01 | **below 4.5**, Figma value kept (team decision, page 07) |
| `#a3a3a8` search placeholder | white | 2.52 | **below 4.5**, Figma value kept (team decision, page 19 — a placeholder, not required reading content) |
| `#98a3b4` muted-cool (team tabs) | white | 2.55 | **below 4.5**, Figma 11 value kept (page 11 "Figma first" decision; team tabs also show on B's 09, B review pending) |
| `#a3a3a8` placeholder-cool | `#f3f4f6` | 2.48 | **below 4.5**, Figma value kept (page 11) |
| `#158000` progress-done | white | 5.29 | pass |
| `#007be6` progress-active | white | 4.37 | **below 4.5**, Figma value kept (page 11) |
| `#e62e00` progress-blocked | white | 4.42 | **below 4.5**, Figma value kept (page 11) |
| `#98a3b4` muted-cool (14 count, repo, date, unchecked menu rows) | white / `#f5f5f5` / `#f2f2f2` / `#f3f4f6` | 2.55 / 2.34 / 2.28 / 2.32 | **below 4.5**, Figma 14 value kept (page 14 "Figma first") |

- **MUST** re-check contrast when text sits on any surface other than white and add a token if no existing one passes.
- Text lighter than `--color-text-meta` is **NEVER** used on a light surface. Exception: the page 07, 11 and 14 Figma values marked above; do not reuse them elsewhere without the same team decision.
- Global `::placeholder` already uses `--color-text-subtle-on-tint` (darker is safe on white and on tint).

## 2. Typography

Font: Pretendard Variable (loaded in `app/layout.tsx`), token `--font-sans`. **App screens use one type scale (mobile sizes only)** — do not bump title sizes on wide browsers.

| Role | Size | Weight | Line height | Tokens |
| --- | --- | --- | --- | --- |
| Page title | 24px | 700 | 1.3 | `--font-size-page-title`, `--font-weight-bold`, `--line-height-page-title` |
| Section title | 20px | 600 | 1.4 | `--font-size-section-title`, `--font-weight-semibold`, `--line-height-title` |
| Card / group title | 18px | 600 | 1.4 | `--font-size-card-title`, `--font-weight-semibold`, `--line-height-title` |
| Body | 16px | 400 | 1.6 | `--font-size-body`, `--font-weight-regular`, `--line-height-body` |
| Medium | 16px | 500 | 1.6 | `--font-weight-medium` with the body, caption, or meta size |
| Caption (helper text) | 14px | 400 | 1.5 | `--font-size-caption`, `--line-height-caption` |
| Meta (time, views) | 13px | 400 | 1.5 | `--font-size-meta`, `--line-height-caption` |
| Micro (page 07 issue meta) | 12px | 500 | 22px | `--font-size-micro`, `--font-weight-medium`, `--line-height-compact` |
| Caption, recruit card description (page 19) | 14px | 400 | 20px | `--font-size-caption`, `--font-weight-regular`, `--line-height-card-desc` |

- Medium (500) is Pretendard Medium for a clause title and its body (page 03) and for offer names, tabs, chips, and status labels (page 33). Other body copy stays 400.
- Buttons and inputs: 16px; button weight 600, input value weight 400. Inputs smaller than 16px make iOS zoom in.
- Error and notice messages: 14px at minimum, never the 13px meta size.
- Hierarchy comes from size, weight and spacing together, not from small gray differences alone.
- If Figma specifies a different size, update the token + this table in the same change.
- Placeholders never replace a visible label (blueprint §6-3).
- Heading elements are chosen for the document outline (blueprint ch. 6), then sized with these roles; the size does not decide `h1`–`h6`.

## 3. Spacing and layout

Tokens in `tokens/layout.css`. 8px base unit, 4px half-step.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-xxs` | 4px | Icon-to-text gap |
| `--space-xs` | 8px | Tight groups |
| `--space-sm` | 12px | Input vertical padding, gap between stacked rows |
| `--space-md` | 16px | Page side gutter, button horizontal padding, input horizontal padding |
| `--space-lg` | 24px | Card padding, gap between groups |
| `--space-xl` | 32px | Gap between form blocks |
| `--space-xxl` | 48px | Large gap inside a section |
| `--space-section` | 48px | Gap between page sections |
| `--space-section-lg` | 80px | Gap between major blocks |
| `--space-row-inline` | 5px | Page 07 row side padding, title to meta (Figma, off the grid) |
| `--space-row-block` | 10px | Page 07 row vertical padding, meta gap (Figma) |
| `--space-list-action` | 15px | Page 07 list to the action below it (Figma) |
| `--space-group` | 20px | Page 07 selected team to its issues (Figma) |
| `--space-block` | 28px | Page 07 my issues to the team tabs (Figma) |
| `--space-sheet-block` | 15px | Page 07 sheet top and bottom padding (Figma) |
| `--space-sheet-action` | 30px | Page 07 sheet list to its CTA (Figma) |
| `--space-icon-text-compact` | 2px | Page 07 compact link, text to icon (Figma) |
| `--space-card-row` | 22px | Page 19 recruit card: gap between the info and meta blocks (Figma) |
| `--space-card-info` | 25px | Page 19 recruit card: chip/deadline row to title/description gap (Figma) |
| `--space-card-meta` | 13px | Page 19 recruit card: role chips row to "자세히 보기" gap (Figma) |
| `--space-chip-block` | 3px | Page 11 filter chip and page 19 role-count / search-panel filter chip vertical padding (Figma) |
| `--space-detail-block` | 14px | Page 19 recruit card "자세히 보기" detail panel top/bottom padding (Figma) |

### 3-1. App column (non-admin)

- **Supported width:** 360–600px for layout QA. Figma frames are the visual source; implement the frame, then verify at 360 and 600.
- **`< 600px`:** column = 100% of the viewport (minus nothing except gutters inside the column).
- **`≥ 600px`:** column = `--content-max-width` (**600px**), horizontally centered. Outside the column: `--color-canvas-outside` (dark `body`, Figma 472:415) only — **NEVER** stretch page content, header, or GNB to the full desktop width.
- **Page gutter** `--page-gutter`: **16px** inside the app column (match Figma; do not grow gutter just because the browser is wide).
- **Admin (25–27):** a separate, desktop-only tool with no mobile layout — own shell, two columns, aside `--admin-aside-width` (blueprint §6-6).

### 3-2. Safe areas and chrome clearance

The product ships as a Next.js web app inside a React Native WebView (`apps/mobile`). Design for a native-like mobile-first column; fixed chrome must not fight scroll.

Apply on app screens (WebView and mobile Safari):

| Layer | Rule |
| --- | --- |
| Top safe zone | `env(safe-area-inset-top)` on the sticky header / status area so content clears the notch |
| Bottom home indicator | `env(safe-area-inset-bottom)` on the bottom tab bar, chat/composer bars, sheets, and toasts |
| Header clearance | Main content top padding accounts for `--header-height` + top safe inset when the header is sticky |
| Tab / composer clearance | Main content (and toasts) sit above `--tab-bar-height` (or the composer height) + bottom safe inset |
| Sheets | Cap height with `--sheet-max-height`; respect top/bottom safe insets so grabber and actions stay tappable |
| Viewport height | Prefer `100dvh` over `100vh` so layout does not jump when the mobile browser chrome shows/hides |
| Viewport metadata | Root `export const viewport` in App Router: `width: 'device-width'`, `initialScale: 1`, `viewportFit: 'cover'` (see `apps/web/app/layout.tsx`). Do not fight an existing root export with a conflicting page-level viewport |

**NEVER** let fixed chrome cover primary actions or message input without compensating padding. Sticky header and bottom tabs **MUST** leave a clear scrollable content band; content that exceeds the band remains reachable by scroll (ch. 3-5).

### 3-3. Touch targets (WCAG 2.2 AA)

| Control | Minimum hit size | Visual size |
| --- | --- | --- |
| Primary CTA, text buttons, list rows, bottom tabs, form controls | `--touch-target-min` (**44px**); buttons/inputs often `--control-height` (48px) | Per Figma |
| Dense header / toolbar **icon clusters** (bell, more, search, close in a tight group) | `--touch-target-icon` (**24px**) hit area | **Exactly Figma** (e.g. 24px icon). **NEVER** enlarge the visible icon box to 44px — that blows up gaps |
| Segmented controls | At least 44px high per option | Per Figma |

- Hit area may use transparent padding around a smaller glyph.
- Icon-cluster spacing follows **Figma gaps**; overlapping hit areas are allowed when needed to keep that spacing.
- Long-press-only actions **MUST** also have a visible control (e.g. “더보기”).

### 3-4. Other frame tokens

- **Whitespace groups content.** Separate sections with `--space-section`, not divider lines. Cards keep `--space-lg` padding so content stays off the edge.
- **Frame sizes:** `--header-height` 56px; `--search-input-height` 52px (mobile search field in the open panel, focus border `--color-focus-ring-search` — the one input that does **not** use the global `--color-focus-ring`); `--badge-dot-size` 6px; `--font-size-badge` 8px (GNB unread chip numeral only); `--tab-bar-height` (content/toast clearance, plus safe-area separately); `--content-max-width` **600px**; `--sheet-max-width` 600px (same as the app column); `--form-max-width` 600px; `--sheet-max-height` 85dvh; `--dialog-max-width` 400px; `--admin-aside-width` 400px; `--icon-size` 24px; `--icon-size-sm` 16px; `--icon-size-lg` 26px (bottom GNB tab icon); `--icon-stroke-width` 2 (Solar Icons; overrides the linear style's own thinner 1.5 default to match Figma `strokeWeight` — the bottom GNB scopes this back to 1.5 locally, its own Figma value); `--space-tab-icon-gap` 6px (GNB icon↔label); `--tab-bar-gap-4` / `--tab-bar-gap-5` 36px / 20px (gap between GNB tabs below 600px, guest vs. signed-in with profile); `--tab-bar-padding-wide` 80px (GNB side padding at/above 600px, replacing the fixed gap with `space-between`); `--control-height-compact` 37px (page 07 link, hit area stays 44px); `--control-height-sheet` 53px; `--avatar-size-team` 50px; `--radio-size` 20px; `--radio-dot-size` 12.5px; `--separator-dot-size` 2px; `--blur-scrim` 6px (page 07 sheet); `--control-height-choice` 40px (page 07 sheet option row, below the 44px minimum: Figma value, front-end owner's decision); `--icon-size-add` 20px (page 07 add-issue icon, hit area stays 44px); `--icon-size-team-entry` 20px (page 07 team-card › / ∨ icon, Figma 5×12 with a 1.5px line, hit area stays 44px); `--control-height-chip` 30px (page 19 filter chip); `--tabs-row-height` 48px (page 19 segmented tabs row); `--recruit-search-panel-height` 119px (page 19 area B open height); `--fab-size` 40px (page 11 team-chat shortcut and page 19 write-recruit FAB; hit area stays 44px via `--touch-target-min`, see §3-3); `--detail-label-width` 80px (page 19 recruit card "자세히 보기" detail panel label column, Figma).
- **Page 11 sizes (Figma 197:66):** `--space-section-inset` 25px (progress band top padding); `--space-card-gap` 15px; `--space-search-icon` 14px (search inset and icon gap); `--space-chip-block` 3px; `--space-fab-bottom` 34px (chat shortcut from the bottom, incl. home indicator); `--radius-card-compact` 12px (status cards, search field); `--control-height-search` 42px; `--control-height-chip-sm` 28px (hit area stays 44px; separate from page 19's `--control-height-chip` 30px); `--control-height-tab` 48px (team tabs); `--icon-size-progress-sm` 20px / `--icon-size-progress-md` 22px (card icons, Figma frames); `--card-height-progress` 85px; `--chart-height` 223px; `--chart-point-size` 10px; `--legend-dot-size` 5px; `--divider-section` 6px (band between trend and list).
- **Page 18 sizes (Figma 248:1243):** `--space-notification-group` 25px (tabs to "전체 읽기", to the first day, and between days); `--space-notification-dot` 13px (dot to text); `--notification-dot-size` 8px (unread `--color-text-slate`, read `--color-text-muted-cool`). Rows reuse `--space-row-block` 10px (row padding, date to list) and `--space-row-inline` 5px (date to "오늘"); tabs reuse page 19's `--tabs-row-height` and tab colors.
- **Page 28 sizes (Figma 288:471, 293:218):** `--space-plan-card` 20px (card padding, card sections, between cards); `--space-plan-intro` 25px (subtitle to toggle); `--space-plan-toggle` 30px (toggle to the first card); `--control-height-plan-toggle` 52px (월간/연간 toggle, 4px inset, pill); `--radius-plan-card` 14px; `--icon-size-plan-check` 18px (Solar check bold). Title 20px semibold, subtitle 14px medium `--color-text-muted-cool`; plan name 16px medium, pitch 12px, price 14px medium, billing line 12px `--color-text-slate`; benefits 14px/20px with a few words in Medium; "구독하기" button 14px medium, Figma 42px raised to `--touch-target-min`. Colors: `--color-plan-card` #f0f0f0, `--color-plan-toggle` #e7e7e7, `--color-plan-toggle-off` #a3a3a8 (low contrast, Figma), `--color-plan-ink` #121212 (selected toggle, button fill, name/price), `--color-plan-accent` #2563eb (benefit check, trial note, entry reason, "이용 중").
- **Page 29 sizes (Figma 294:306, 295:459, 364:1694):** `--space-manage-block` 15px (between plan card, info box and payment history); plan card `--space-manage-card` 13px padding, `--radius-manage-card` 6px, fill `--color-canvas-cool` with `--color-hairline-cool` border; label 12px `--color-plan-accent`, plan name 16px medium, description 12px `--color-text-slate` (`--space-manage-name` 7px below the name); "요금제 변경하기" `--color-plan-ink`, `--radius-xxs`, Figma 36px raised to `--touch-target-min`. Info box `--radius-xxs`, side padding `--space-manage-row` 17px, rows `--row-height-manage-info` 35px (tappable rows 44px) with `--color-manage-divider` #f1f1f1 between, 12px `--color-text-slate`; chevrons `--icon-size-manage-chevron` 20px. Payment rows 65px: date 14px `--color-text-slate`, plan line 14px `--color-text-muted-cool`, amount 14px medium `--color-text-title-cool`, `--color-hairline-cool` divider. Confirm modal `--dialog-width-manage` 320px, `--radius-manage-dialog` 10px, 20px padding, title 20px semibold, body 14px slate, text buttons 16px semibold ("취소하기" `--color-plan-accent`, action `--color-text-muted-cool`, low contrast as drawn), scrim `--color-scrim-team-picker` + `--blur-scrim`.
- **Page 14 sizes (Figma 200:1028):** `--board-column-width` 240px; `--board-column-gap` 20px (between columns, tabs → toolbar → columns); `--board-column-line` 4px (status-colored top line); `--space-board-column` 15px; `--space-board-card-block` 12px / `--space-board-card-inline` 10px (card padding); `--space-board-card-head` 13px; `--space-board-label-gap` 10px; `--space-board-control-gap` 9px; `--space-board-control-block` 6px / `--space-board-control-inline` 10px / `--space-board-control-icon` 5px (buttons); `--space-board-menu-offset` 5px / `--space-board-status-menu-offset` 3px; `--radius-board-card` 5px; `--control-height-board` 30px (hit area stays 44px); `--control-height-board-status` 40px; `--board-menu-width` 111px; `--board-menu-row-height` 38px; `--board-status-dot-size` 8px; `--icon-size-board-chevron` 16px / `--icon-size-board-status-chevron` 12px. Type: `--font-size-board-control` 15px, `--line-height-board-control` 1.2.
- **Layers:** `--z-chrome` 10 (sticky header, bottom tabs) < `--z-overlay` 100 (scrim, sheets, dialogs) < `--z-toast` 200 (toasts, focused skip link).
- **Motion:** `--duration-overlay` 200ms with `--ease-standard` for sheets, dialogs and toasts; `--duration-chrome-collapse` 320ms (page 19 scroll-driven header/tabs/search-panel reveal — slower than `--duration-overlay` so the slide reads as deliberate, not a snap); globals.css turns it off under `prefers-reduced-motion`. The sticky header is a frosted `--color-header-bg` + `--blur-chrome` (`--blur-header-open` when the mobile search panel is down) plate, not a solid fill — the header and open search panel share one frosted plate rather than two. The bottom GNB pill uses the same `--blur-chrome` frost over `--color-gnb-bg`.
- **Images:** keep a fixed aspect ratio and `--radius-md` corners unless Figma says otherwise. Use `next/image` (blueprint ch. 10).

### 3-5. Scroll and touch (WebView)

Goal: a native-like touch and scroll feel in the Expo / React Native WebView shell. Visual chrome stays clean; every overflowed region stays reachable.

#### 3-5-1. Default scroll policy

- Allow **both** vertical and horizontal scroll where the UI needs them.
- **MUST** hide scrollbars visually by default; **MUST** keep actual scrolling (touch, swipe, mouse wheel) working.
- Overflowed content **MUST** remain reachable — hiding the scrollbar is not the same as disabling scroll.
- Prevent **accidental** page-wide horizontal scroll (e.g. at 360px / 600px QA widths). Horizontal scroll is allowed only for intentional horizontal explorers (kanban boards, chip rows, media carousels).
- **NEVER** apply global `overflow: hidden` on `html` / `body` (or a full-page wrapper) in a way that blocks document scroll. Use `overflow: hidden` only on a local clip (avatar, ellipsis line, media crop).

#### 3-5-2. Scrollbar hiding

Default policy lives in global CSS (`apps/web/styles/globals.css`):

```css
* {
  scrollbar-width: none; /* Firefox */
}

*::-webkit-scrollbar {
  display: none; /* Chromium / WebKit / RN WebView */
}
```

| Do | Do not |
| --- | --- |
| Hide the scrollbar chrome only | Treat “no scrollbar” as “no scroll” |
| Keep `overflow: auto` / `overflow-x: auto` / `overflow-y: auto` on scroll regions | Replace needed `auto` with `hidden` just to hide bars |
| Verify scroll still works in iOS and Android WebView after the global rule | Assume desktop browser QA alone is enough |

Screen-specific scroll recipes stay in that screen’s module CSS; do not pile one-off scroll hacks into `globals.css`.

#### 3-5-3. Two-axis and nested scroll (e.g. kanban)

When a board needs horizontal column travel **and** vertical card lists:

| Axis | Rule |
| --- | --- |
| Horizontal (board) | The board surface swipes left/right when columns exceed the column width. Keep column widths and gaps consistent. |
| Vertical (per column) | Each column’s card list scrolls independently. Cap column height so a long list does not stretch the board forever. |
| Scrollbars | Hide both the board’s horizontal bar and each column’s vertical bar; keep both axes scrollable. |
| Isolation | Scrolling one column **MUST NOT** move another column’s scroll offset. |

#### 3-5-4. Gesture conflict avoidance

Nested horizontal → vertical scrollers fight touch gestures if axes are not separated. Design so that:

- Horizontal swipe moves board columns.
- Vertical swipe moves that column’s cards.
- Diagonal swipes do not produce stuck or fighting gestures.
- Reaching a scroll edge: review whether the event should chain to the parent (`overscroll-behavior` and related). Prefer intentional containment over accidental parent scroll.
- Use `touch-action`, `overscroll-behavior`, and `-webkit-overflow-scrolling` **only when needed**, after verifying on device WebViews — **NEVER** sprinkle them globally “just in case”.

#### 3-5-5. WebView verification (required)

Validate on **iOS React Native WebView** and **Android React Native WebView**:

1. Horizontal swipe moves kanban (or other) columns
2. Vertical swipe scrolls cards inside a column
3. Diagonal swipe does not lock or fight axes
4. Columns keep independent scroll positions
5. Edge / overscroll behavior is acceptable
6. No scrollbar chrome is visible
7. Touch scroll feels responsive (no unexpected jank or capture)
8. Sticky header / bottom tabs do not collide with the scroll band (ch. 3-2)

#### 3-5-6. Maintenance

- Mobile-first; account for iOS vs Android WebView rendering differences.
- Keep the existing token + CSS Modules structure; avoid drive-by global style changes.
- Give each scrollable region a clear responsibility (page / board / column / sheet).
- Page-only scroll policies stay next to that page; shared defaults stay in `globals.css` + this section.

## 4. Shape and elevation

| Token | Value | Use |
| --- | --- | --- |
| `--radius-none` | 0 | Full-bleed media |
| `--radius-xxs` | 4px | Offer cards, status chips, and the rectangular open-chat button on page 33 |
| `--radius-xs` | 8px | Floating mobile bottom GNB pill (if Figma uses it) |
| `--radius-control-sm` | 10px | Page 07 compact link |
| `--radius-control-md` | 14px | Page 07 sheet CTA (Figma) |
| `--radius-control-lg` | 12px | Page 19 recruit search field (Figma) |
| `--radius-sm` | 16px | Inputs, small cards, accordion rows |
| `--radius-lg` | 20px | Frosted pills when Figma uses them |
| `--radius-md` | 24px | Content cards, bottom sheet top corners, footer top corners |
| `--radius-full` | 9999px | Pills: buttons, badges, toggles |

Avatars are circles (`--radius-full`).

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | Flat on `--color-canvas` | Default |
| 1 | `--color-canvas-soft` fill, no border | Nav pill, featured card, accordion row, soft pill |
| 2 | 1px `--color-hairline-soft` outline on white | Cards |
| Inverse | `--color-primary` fill, `--color-text-inverse` text | Footer, primary CTA |

- No drop shadow on cards, buttons or nav. The one exception is the active segment of a segmented control (`--shadow-segment-active`).
- Recorded exception: page 07 compact link uses `--shadow-compact-link` (`0 0 4px rgb(0 0 0 / 0.12)`). 07 Figma value, front-end owner's decision (Figma first). Do not reuse it elsewhere.
- Recorded exception: page 11 team chat shortcut and page 19 write-recruit-post FAB share `--shadow-fab` (`0 0 2px rgb(222 222 222 / 0.25)`). Figma values for those screens. Do not reuse it elsewhere.
- Recorded exceptions: page 14 columns use `--shadow-board-column` (`0 4px 10px rgb(0 0 0 / 0.15)`) and its dropdown menus `--shadow-board-menu` (`0 2px 4px rgb(0 0 0 / 0.15)`). 14 Figma values ("Figma first"). Do not reuse them elsewhere.
- Bottom sheets, dialogs and drawers are separated from the page by `--color-scrim`, not by a shadow. Sheets use `--radius-md` on their top corners unless Figma specifies otherwise.

## 5. Components

Each item says the default Linker recipe. **When Figma for that screen conflicts, Figma wins** — update tokens if needed, then match the frame. Write components as `*.module.css` using tokens. A component not listed is composed from ch. 1–4 without new values. Prefer page `_components/` over growing a large shared kit during MVP.

**Button, primary** — the single CTA style.
- Fill `--color-primary`, label `--color-on-primary`, 16px / 600, `--radius-full`, height `--control-height`, padding `0 var(--space-md)`.
- Never use `--color-accent` as a CTA fill.

**Button, outline** — the quieter twin, for a second action next to the primary or for third-party login.
- Fill `--color-canvas`, label `--color-text-heading`, 1px `--color-hairline` border, same shape as primary.

**Button, soft pill** — tertiary link-style action ("더 보기" / Load more, outbound links).
- Fill `--color-canvas-soft`, label `--color-text-heading`, no border, `--radius-full`.

**Text input**
- Fill `--color-field`, no border, value `--color-text-body`, placeholder `--color-text-subtle-on-tint`, `--radius-sm`, padding `var(--space-sm) var(--space-md)`, height at least `--control-height`.
- Focus: the global 2px `--color-focus-ring` outline (never removed).
- Error: add a 1px `--color-status-error` border, set `aria-invalid`, and show the message below in `--color-status-error` at 14px or larger. Color is never the only signal.
- The field name is a visible `<label>` outside the input.

**Card**
- Default: `--color-canvas` fill, 1px `--color-hairline-soft` outline, `--radius-md`, padding `--space-lg`.
- Featured (selected plan, highlighted item): `--color-canvas-soft` fill, no outline. Emphasis by tint, not by outline or dark fill.
- Title `--color-text-title` at card-title size; supporting text `--color-text-secondary`; meta `--color-text-meta`.

**Team member count** — Write it as "멤버 N명". **NEVER** show it against capacity such as "5/6" (front-end owner's decision).

**Accordion row** (FAQ, collapsible group)
- Full-width `--color-canvas-soft` bar, `--radius-sm`, question in body size with a trailing chevron, rows `--space-sm` apart. It is a `<button>` with `aria-expanded` (blueprint ch. 6).

**Badge**
- Highlight badge: `--color-accent` fill, `--color-on-primary` label, `--radius-full`. The only blue element on a screen unless Figma adds more.
- Neutral badge (counts, status): `--color-canvas-soft` fill with `--color-text-secondary` label.

**Segmented control** (tab-like toggle)
- Track `--color-canvas-soft`, `--radius-full`. Active option is a `--color-canvas` pill with `--shadow-segment-active`; inactive label `--color-text-secondary`. Each option is at least 44px high.

**Top nav** — sticky, width capped with the app column (`--content-max-width`). Logo + icon actions per Figma (search, notifications, settings — no profile icon here). Icon clusters use §3-3 (24px hit, Figma visual). Unread: `--badge-dot-size` accent dot + sr-only text. **NEVER** switch to a desktop search-field layout on wide browsers.

**Footer**
- `--color-primary` band with `--radius-md` top corners when used. Wordmark and emphasis links in `--color-text-inverse`; tagline and ordinary links in `--color-text-inverse-secondary`. Focus ring inside it uses `--color-focus-ring-on-dark`.

**Bottom tab bar** — sits in the same centered app column; bottom safe-area inset. Icon + label per Figma; active tab `--color-gnb-current`, inactive `--color-gnb-inactive`, both with a semibold label for the active tab (not color alone). Guests get 4 tabs (`--tab-bar-gap-4`); signed-in members add a 5th **프로필** tab — the viewer's own avatar image, not a Solar icon — and use `--tab-bar-gap-5`. At the **600px** upper bound the pill switches from a centered block with a fixed gap to edge-anchored tabs — fixed `--tab-bar-padding-wide` (80px) side padding, gap computed by `space-between` (Figma 476:563/593), same for 4- and 5-tab. **NEVER** replace icons with a desktop text-only GNB on wide browsers.

**Bottom sheet / dialog** — `--color-canvas` surface over `--color-scrim`. Sheets: `--radius-md` top corners, `--space-lg` padding, at most `--sheet-max-height`, safe-area aware. Dialogs: `--radius-md`, at most `--dialog-max-width`. Title in section-title type, description in caption `--color-text-secondary`. Close control: Figma visual + §3-3 hit rules.

**Toast** — inverse surface: `--color-primary` fill, `--color-text-inverse` caption text, `--radius-sm`, above the bottom tab bar + safe-area. Focus ring inside uses `--color-focus-ring-on-dark`.

**Disabled button** — 50% opacity with `not-allowed` cursor; the reason is given in text, never by the dimming alone.

**Destructive button** — the outline button with a `--color-status-error` label (delete, leave, block). Never a red fill.

**Not defined yet** — calendar cells, chat bubbles, dark mode. Prefer the screen’s Figma; otherwise compose from ch. 1–4 and add a token here in the same change when a value is new.

## 6. Mobbin reference — retired

The earlier Mobbin-based visual system is **no longer an authority**. Do not restore its desktop top-nav, text-only wide GNB, 1440px app shell, or 1024px type bumps for app screens.

Still kept on purpose:

- Token **infrastructure** (`color` / `typography` / `layout`) and the CSS Modules + `var(--token)` rule
- Minimal shared UI (`Button`, empty/error states, overlays shell, layout frames)
- Accessibility and Policy/Page TODO product rules

When implementing a page: match **Figma** first; put one-off UI in that page’s `_components/`.

## 7. Open points

- **Input boundary contrast.** The input fill (`#f0f0f0`) is 1.14:1 against white, below the 3:1 WCAG 1.4.11 asks for when a control's shape is the only cue. The visible label and the focus ring cover it today; if the team wants strict compliance, add a 1px border token of about `#8a8a8a` and update ch. 5. Decision pending.
- **Hairline outlines** (`#e0e0e0`, `#f0f0f0`) are decoration, not identification: every outlined control also carries a text label.
- **Figma ↔ token sync.** When a new frame introduces a color/size not in tokens, add the token in the same PR as the screen — do not leave raw values in the module.

## 8. Checklist before a screen is done

- [ ] Matched the page’s **Figma** frame (no invented desktop/tablet app layout)
- [ ] No raw hex, font size, spacing or radius in the module CSS; everything is `var(--…)`
- [ ] Text on tinted or dark surfaces uses the on-tint / inverse tokens (ch. 1-2)
- [ ] Accent is not used for text on a tinted surface or as a CTA fill
- [ ] App column works at **360** and **600**; above 600 the column stays **600 centered** (admin exempt)
- [ ] Top/bottom **safe-area** + header/tab (or composer) clearance applied; prefer `100dvh` / root `viewportFit: 'cover'`
- [ ] Scrollbars hidden without disabling scroll; no global `overflow: hidden` blocking the page
- [ ] Nested horizontal/vertical scroll (if any) keeps axes independent; checked in iOS and Android WebView
- [ ] UI icons come from **Solar Icons**, not Lucide as the default
- [ ] Primary controls ≥ 44px hit; icon clusters use **24px hit** without enlarging Figma visuals
- [ ] Input font is 16px; no hover-only interaction
- [ ] Error, success and warning states have a message, not color alone
- [ ] No shadow except `--shadow-segment-active`
