# Linker — agent guide

## Project and scope
- Developer platform for team recruitment, GitHub collaboration, project posts, and recruiter offers via chat.
- Five-person, two-week MVP: mobile-first web + Expo WebView development build; no store release. Toss Payments is test mode only.
- UI language is Korean. Use documented UI copy verbatim.
- `frontend/`: pnpm/Turborepo, Next.js 16 web, Expo shell, generated API and bridge packages. Read `frontend/AGENTS.md` before frontend work.
- `backend/`: Spring Boot/Gradle, Security, JPA, PostgreSQL, Redis, WebSocket/STOMP, springdoc. Package layout is `docs/development/05-backend-blueprint.md` §6. Read a local `AGENTS.md` or `CLAUDE.md` if present.
- `CLAUDE.md` files only import the same-folder `AGENTS.md` (`@AGENTS.md`). Put all guidance in `AGENTS.md`, not `CLAUDE.md`.

## Work areas (WBS ch. 0)
One person owns both frontend and backend of their pages (controller owner = page owner).

| Owner | Area | Pages |
| --- | --- | --- |
| A | Accounts & recruiting | 01, 02, 03, 04, 05, 06, 25, 31, 32, 33 |
| B | GitHub, teams, ops | 07, 08, 09, 10, 26, 27, 30 + PR posting in 17 |
| C | Issues | 11, 12, 13, 14, 15 + my issues in 07 + AI summary (Flex) in 17 + progress card (Flex) in 11 |
| D | Chat, notifications, subscription | 16, 17, 18, 28, 29 |
| E | Find Team & project posts | 19, 20, 21, 22, 23, 24 |

Foundation page 00 (D1–D2) is split across everyone; see WBS ch. 3.

## Four roles
Guest (read-only on feed, posts, recruit posts, profiles) / Developer (GitHub login) / Recruiter (company email sign-up) / Operator (developer account + `admins` row + OTP). The single role × page/action table is Policy ch. 2.

## Read only the relevant documentation
| Source | Authority |
| --- | --- |
| `docs/planning/01-service-plan.md` | Product direction and architecture |
| `docs/planning/02-prd.md` | Feature IDs and completion conditions |
| `docs/planning/03-mvp-definition.md` | Scope and launch conditions |
| `docs/planning/04-policy.md` | All numbers, limits, states, roles, exceptions, UI copy |
| `docs/planning/05-terms-of-service.md`, `docs/planning/06-privacy-policy.md` | Legal wording |
| `docs/planning/07-page-todo.md` | Pages, URLs, screen contents |
| `docs/development/01-erd.md` | Tables, columns, enums |
| `docs/development/02-wbs.md` | Endpoints, controllers, ownership, permissions, schedule |
| `docs/development/05-backend-blueprint.md` | Backend architecture, Java packages, layer rules, migration. Korean reading copy: `05-backend-blueprint.ko.md` |
| `docs/development/03-frontend-blueprint.md` | Frontend implementation rules; Policy, Page TODO and WBS take precedence |
| `docs/development/04-design-guide.md` | Colors, type, spacing, shapes, component styles; token values in `frontend/apps/web/src/styles/tokens/` |

- Search for the relevant page number, feature, table, or controller instead of reading every document.
- `[Required]` is essential; `[Included]` may be deferred in the order in WBS ch. 6.
- Complete foundation page 00 before page work; follow pages 01–33. Page and controller ownership are the same (WBS ch. 0).
- Page numbers identify work. They are not Java package names. One page keeps one owning controller. Services, repositories, and entities are shared by business responsibility and are not split one-to-one with pages or roles (WBS §1-3, backend blueprint §6).
- Guest, Developer, Recruiter, Operator access follows Policy ch. 2. Team owner/admin/member permissions are separate (ch. 6).

## Fixed decisions
- GitHub App, not OAuth App. GitHub is authoritative for issues, PRs, orgs; read Linker's DB copy maintained by webhooks and periodic sync.
- Chat uses Spring WebSocket + STOMP, with `@stomp/stompjs` on web.
- JWT stays in an httpOnly parent-domain cookie; never expose it to JavaScript or the native bridge.
- Index only developer profiles, posts, and recruitment posts; everything else is `noindex`.
- Backend hosting, email provider, and AI summary model remain open decisions: ask the user before selecting them.

## Backend packages
Follow `docs/development/05-backend-blueprint.md` §6. WBS §1-3 owns the API contract; the blueprint owns the packages.

- Base package: `com.linker.backend`. Layers: `controller`, `service`, `repository`, `entity`, `dto`, plus `integration`, `async`, and `global`.
- Group controllers by caller role: `common`, `public`, `user`, `recruiter`, `admin`. The seven foundation controllers stay in `controller.common`. A page controller whose WBS permissions use more than one caller group goes in `controller.multi` and maps each method with its own role prefix.
- Do not add `api/common`, numbered page packages (`p01_login`), or a `domain` package that holds controllers, entities, and repositories together. Do not give each page or role its own copy of a service, repository, or entity.
- Put request and response DTOs under `dto`, using `request` and `response` subpackages when a capability has both. Do not place them beside controllers, and do not return entities from controllers.
- Keep HTTP paths, permissions, OpenAPI `@Tag` names (for example `p11-issue-list`), and STOMP destinations when classes move. A Java package does not define a URL.
- File placement is blueprint §4. Keep `global.error`. Do not add `global.exception`, `global.response`, or `service.support`.

## Keep code and documents consistent
- Table/column/enum changes: update ERD diagrams, notes, enum list, page mapping, counts, and WBS page tables.
- Endpoint changes: update WBS page definitions, controller counts, and totals. Each endpoint has one owning page; others borrow it.
- Page/URL/screen changes: update TODO and page list, WBS, Policy access matrix, and blueprint ch. 13.
- Number/rule changes: update Policy first, then TODO and code. Centralize values in `frontend/apps/web/src/lib/policy.ts` and backend `PlanLimits`/server config, never DB or scattered literals.
- Keep documented totals consistent (baseline: 33 pages, 40 controllers, 204 REST endpoints, 5 STOMP destinations, 69 tables).
- `docs/` translates Korean originals maintained outside this repo. Report doc changes so the user can update those originals.

## Git workflow
### Branches
- `main`: stable, release-ready version.
- `dev`: integration and testing branch for the team's work.
- Work branches: feature, bug fix, configuration, and documentation work. Created per type:

| Type | Purpose | Branch example |
| --- | --- | --- |
| `feat` | New feature | `feat/login-implementation` |
| `fix` | Bug fix | `fix/login-error` |
| `chore` | Configuration and other maintenance | `chore/eslint-config` |
| `docs` | Writing or editing documents | `docs/git-convention` |

### Workflow
1. Switch to the latest `dev` and pull.
2. Create a work branch of the matching type.
3. Do the work and commit following the commit convention.
4. Push the work branch to the remote.
5. Open a PR from the work branch into `dev`.
6. Review and test the changes, then merge into `dev`.
7. When development is complete, merge `dev` into `main`.

### Rules
- Never commit directly to `main` or `dev`.
- Pick the branch type that matches the work; one main task per branch (separate unrelated scope into another branch).
- Every work branch opens its PR into `dev`. Review and test before merging.
- Delete a work branch after it is merged. (Agents: only with explicit user approval.)
- No `release` or `hotfix` branches; this is a two-week project.
- Prefer matching branch type and commit type.

### Branch naming
Format: `<type>/<description>`
- Type is lowercase: `feat`, `fix`, `chore`, `docs` only. Use `feat`, never `feature`.
- Description is short and clear, with words joined by hyphens (kebab-case).

### Commit messages
Format: `<type>: <description>` (one space after the colon).
- Type is one of `feat`, `fix`, `chore`, `docs`.

| Type | Purpose | Commit example |
| --- | --- | --- |
| `feat` | New feature | `feat: implement login` |
| `fix` | Bug fix | `fix: fix login error` |
| `chore` | Configuration and other maintenance | `chore: configure ESLint` |
| `docs` | Writing or editing documents | `docs: write Git convention` |

- Write the description short and clear. One main change per commit.
- Never use vague messages such as "fix", "work", or "update".

### Agent safety
- Destructive operations (`reset --hard`, force-push, branch deletion) require explicit user approval.
- Inspect branch and status before Git operations; clarify unclear state before potentially destructive commands.
