# Linker Design Guide

> Question this document answers: **Which colors, type sizes, spacing, shapes and component looks does Linker use, and how are they written in CSS?**
> Structure and code rules are in [10 Frontend Blueprint](./10-frontend-blueprint.md); this document only covers how things look. Token values live in code at `apps/web/src/styles/tokens/` (`color.css`, `typography.css`, `layout.css`). If this document and the token files disagree, fix them together in the same change.
>
> `MUST` and `NEVER` are followed without exception. `RECOMMENDED` needs judgment.

## 0. Rules at a glance

1. **MUST** style with CSS Modules (`*.module.css` next to the component) and read every color, size, space and radius through `var(--token)`. **NEVER** write a hex color, a font size or a radius as a raw value in a component.
2. **MUST NOT** add a new color, font size or radius in a component. Add the token first (token file + this guide), then use it.
3. Mobile first: base styles target a 360px screen; widen with `@media (min-width: 600px | 1024px)` (tablet, desktop). No `max-width` queries for layout.
4. Source order when values conflict: **text color and type** (ch. 2) over **palette** (ch. 1) over **everything else** (ch. 3–5). Text on a white surface uses the `--color-text-*` tokens only.
5. Shadow-free. Depth comes from fill differences and 1px hairlines (ch. 4). The only shadow token is `--shadow-segment-active`.
6. Never signal state by color alone. Pair color with text, an icon or a border (WCAG 1.4.1).

## 1. Color

Tokens in `tokens/color.css`. Surface is white (`--color-canvas`) unless noted; contrast is measured against it.

### 1-1. Surface, brand, border

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#141414` | Primary CTA fill, footer band, focus ring |
| `--color-on-primary` | `#ffffff` | Text and icons on `--color-primary` (18.4:1) |
| `--color-accent` | `#0066ff` | Popular/new badges, savings emphasis. **NEVER** a CTA fill |
| `--color-canvas` | `#ffffff` | Page and card background |
| `--color-canvas-soft` | `#f3f3f3` | Nav pill, featured card, accordion row, toggle track, soft pill |
| `--color-field` | `#f0f0f0` | Input fill |
| `--color-hairline-soft` | `#f0f0f0` | 1px outline of cards on white |
| `--color-hairline` | `#e0e0e0` | Outline buttons and interactive control borders |
| `--color-scrim` | `rgb(20 20 20 / 0.5)` | Behind bottom sheets, dialogs, drawers |

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
| `#ffffff` on accent badge | `#0066ff` | 4.83 | pass |

- **MUST** re-check contrast when text sits on any surface other than white and add a token if no existing one passes.
- Text lighter than `--color-text-meta` is **NEVER** used on a light surface.
- Global `::placeholder` already uses `--color-text-subtle-on-tint` (darker is safe on white and on tint).

## 2. Typography

Font: Pretendard Variable (loaded in `app/layout.tsx`), token `--font-sans`. Mobile sizes by default; desktop sizes from 1024px (the tokens switch themselves). Tablets keep mobile sizes.

| Role | Size m / d | Weight | Line height | Tokens |
| --- | --- | --- | --- | --- |
| Page title | 24 / 32px | 700 | 1.3 | `--font-size-page-title`, `--font-weight-bold`, `--line-height-page-title` |
| Section title | 20 / 24px | 600 | 1.4 | `--font-size-section-title`, `--font-weight-semibold`, `--line-height-title` |
| Card / group title | 18 / 20px | 600 | 1.4 | `--font-size-card-title`, `--font-weight-semibold`, `--line-height-title` |
| Body | 16px | 400 | 1.6 | `--font-size-body`, `--font-weight-regular`, `--line-height-body` |
| Caption (helper text) | 14px | 400 | 1.5 | `--font-size-caption`, `--line-height-caption` |
| Meta (time, views) | 13px | 400 | 1.5 | `--font-size-meta`, `--line-height-caption` |

- Buttons and inputs: 16px; button weight 600, input value weight 400. Inputs smaller than 16px make iOS zoom in.
- Error and notice messages: 14px at minimum, never the 13px meta size.
- Hierarchy comes from size, weight and spacing together, not from small gray differences alone.
- Do not enlarge body text on desktop. Adjust titles and spacing first.
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
| `--space-section` | 48px → 80px at 1024px | Gap between page sections |
| `--space-section-lg` | 80px → 120px at 1024px | Gap between major blocks |

The two section tokens are Linker's mobile adaptation: the source guide's fixed 80/120px is too tall for a 360px screen.

- **Whitespace groups content.** Separate sections with `--space-section`, not divider lines. Cards keep `--space-lg` padding so content stays off the edge.
- **Page gutter** is `--page-gutter`: 16px on mobile, 24px from 600px, 32px from 1024px.
- **Container:** app screens fill the width up to `--content-max-width` (1440px) and are centered beyond it. Admin screens are outside this rule and keep their own shell (list + detail two columns at 1024px, blueprint §6-6).
- **Breakpoints:** mobile `360–599px` (base), tablet from `600px`, desktop from `1024px` (desktop type, `--space-section*`, `--page-gutter`). Admin keeps `1024px` two-column and `1280px` default grid. Custom properties cannot be used in `@media`, so write the px value.
- **Tablet follows mobile:** same nav and type sizes as mobile; only content width, column count (cards 1 → 2) and gutter grow. Desktop adds more columns and the desktop type sizes.
- **Collapsing:** multi-column grids drop one column at a time as the screen narrows (3 → 2 → 1). Two-panel layouts drop the secondary panel on narrow screens.
- **Touch targets:** at least `--touch-target-min` (44px). Buttons and inputs are `--control-height` (48px).
- **Frame sizes:** `--header-height` 56px (top bar), 80px from 1024px (room for the desktop search field); `--header-search-width` 512px (desktop top nav search field); `--badge-dot-size` 6px (unread dot); `--tab-bar-height` 56px (bottom tabs, plus the safe-area inset), `--content-max-width` 1440px, `--tab-bar-max-width` 640px, `--sheet-max-width` 640px, `--sheet-max-height` 85dvh, `--dialog-max-width` 400px, `--admin-aside-width` 400px, `--icon-size` 24px.
- **Layers:** `--z-chrome` 10 (sticky header, bottom tabs) < `--z-overlay` 100 (scrim, sheets, dialogs) < `--z-toast` 200 (toasts, focused skip link).
- **Motion:** `--duration-overlay` 200ms with `--ease-standard` for sheets, dialogs and toasts; globals.css turns it off under `prefers-reduced-motion`.
- **Images:** screenshots and mockups keep a fixed aspect ratio and `--radius-md` corners at every size. Use `next/image` (blueprint ch. 10).

## 4. Shape and elevation

| Token | Value | Use |
| --- | --- | --- |
| `--radius-none` | 0 | Full-bleed media |
| `--radius-sm` | 16px | Inputs, small cards, accordion rows |
| `--radius-md` | 24px | Content cards, bottom sheet top corners, footer top corners |
| `--radius-full` | 9999px | Every pill: buttons, badges, toggles, nav pill |

Avatars are circles (`--radius-full`).

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | Flat on `--color-canvas` | Default |
| 1 | `--color-canvas-soft` fill, no border | Nav pill, featured card, accordion row, soft pill |
| 2 | 1px `--color-hairline-soft` outline on white | Cards |
| Inverse | `--color-primary` fill, `--color-text-inverse` text | Footer, primary CTA |

- No drop shadow on cards, buttons or nav. The one exception is the active segment of a segmented control (`--shadow-segment-active`).
- Bottom sheets, dialogs and drawers are separated from the page by `--color-scrim`, not by a shadow. Sheets use `--radius-md` on their top corners.

## 5. Components

Each item says what it is made of. Write them as `*.module.css` using the tokens above. A component not listed is composed from ch. 1–4 without new values.

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

**Accordion row** (FAQ, collapsible group)
- Full-width `--color-canvas-soft` bar, `--radius-sm`, question in body size with a trailing chevron, rows `--space-sm` apart. It is a `<button>` with `aria-expanded` (blueprint ch. 6).

**Badge**
- Highlight badge: `--color-accent` fill, `--color-on-primary` label, `--radius-full`. The only blue element on a screen.
- Neutral badge (counts, status): `--color-canvas-soft` fill with `--color-text-secondary` label.

**Segmented control** (tab-like toggle)
- Track `--color-canvas-soft`, `--radius-full`. Active option is a `--color-canvas` pill with `--shadow-segment-active`; inactive label `--color-text-secondary`. Each option is a full pill-sized target (at least 44px high).

**Top nav** — sticky, content up to `--content-max-width`. Contains the logo, search, notifications, settings (my page) and the login button (guests). Mobile and tablet share one layout (logo + bell, or logo + "로그인" for guests); desktop (1024px+) adds the search field and replaces those with text buttons: guests get "설정" next to a "무료로 시작하기" CTA, members get "알람" next to a circular profile link instead.
- Desktop search field: `--color-field` fill, `--radius-full` (pill, not the standard input's `--radius-sm`), height `--control-height`, width up to `--header-search-width`, centered between the logo and the right-hand actions. Leading `--icon-size` search icon, `--space-sm` gap to the placeholder/value text (`--font-size-body`). Shown for guests and members alike.
- "설정" / "알람" share one pill style: `--color-field` fill (not the generic soft-pill's `--color-canvas-soft`, per the Figma reference), `--color-text-heading` label; "무료로 시작하기" is the primary button. All three: `--control-height`, `--radius-full`, `--space-md` horizontal padding, `--font-size-body` / `--font-weight-semibold` label.
- Desktop profile link (members only): circular, `--control-height` diameter, `--color-canvas-soft` fill, 1px `--color-hairline-soft` border, `UserRound` icon until a real avatar is wired in.
- Unread notifications: a `--badge-dot-size` `--color-accent` dot at the "알람" button's top-right corner (ch. 5 "Badge" highlight style), `--space-xs` inset from each edge. Paired with sr-only text, never the dot alone.

**Footer**
- `--color-primary` band with `--radius-md` top corners. Wordmark and emphasis links in `--color-text-inverse`; tagline and ordinary links in `--color-text-inverse-secondary`. Focus ring inside it uses `--color-focus-ring-on-dark`.

**Bottom tab bar** — on every screen size (mobile, tablet, desktop). Tablet and desktop share one layout; the items stay centered within `--tab-bar-max-width`. Fixed `--color-canvas` bar with a 1px `--color-hairline-soft` top line, `--tab-bar-height` + safe-area inset. Icon over a meta-size label; inactive `--color-text-meta`, current `--color-text-heading` with a semibold label (not color alone).

**Bottom sheet / dialog** — `--color-canvas` surface over `--color-scrim`. Sheets: `--radius-md` top corners, `--space-lg` padding, at most `--sheet-max-height`. Dialogs: `--radius-md`, at most `--dialog-max-width`. Title in section-title type, description in caption `--color-text-secondary`, close is a 44px icon button.

**Toast** — inverse surface like the footer: `--color-primary` fill, `--color-text-inverse` caption text, `--radius-sm`, above the bottom tab bar. Focus ring inside uses `--color-focus-ring-on-dark`.

**Disabled button** — 50% opacity with `not-allowed` cursor; the reason is given in text, never by the dimming alone.

**Destructive button** — the outline button with a `--color-status-error` label (delete, leave, block). Never a red fill.

**Not defined yet** — calendar cells, chat bubbles, dark mode. Compose from ch. 1–4 for now; when a decision is made, add it here (and the token if one is needed) in the same change.

## 6. Left out of the source design reference on purpose

The Mobbin-based reference this guide was built from contains parts Linker does not use. They are not tokens or components here:

- Its font (Saans), display type sizes and text colors (replaced by Pretendard and the typography guide).
- Pricing/testimonial/award/portrait/comparison-table layouts, marquee strips, glass-pillar gradients, grayscale photo treatment and the `badge-overlay` scrim (its translucent gray under white text cannot guarantee 4.5:1 over photos).
- App-icon squircles and the `ex-*` illustrative surfaces.

## 7. Open points

- **Input boundary contrast.** The input fill (`#f0f0f0`) is 1.14:1 against white, below the 3:1 WCAG 1.4.11 asks for when a control's shape is the only cue. The visible label and the focus ring cover it today; if the team wants strict compliance, add a 1px border token of about `#8a8a8a` and update ch. 5. Decision pending.
- **Hairline outlines** (`#e0e0e0`, `#f0f0f0`) are decoration, not identification: every outlined control also carries a text label.

## 8. Checklist before a screen is done

- [ ] No raw hex, font size, spacing or radius in the module CSS; everything is `var(--…)`.
- [ ] Text on tinted or dark surfaces uses the on-tint / inverse tokens (ch. 1-2).
- [ ] Accent is not used for text on a tinted surface or as a CTA fill.
- [ ] Layout written for 360px first, widened at 600 / 1024.
- [ ] Buttons and inputs are at least 44px; input font is 16px.
- [ ] Error, success and warning states have a message, not color alone.
- [ ] No shadow except `--shadow-segment-active`.
