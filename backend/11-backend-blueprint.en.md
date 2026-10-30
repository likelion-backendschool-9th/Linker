# Linker Backend Blueprint (English)
> Source basis: `01-서비스-기획서.md` through `11-README.md` (repository state as of 2026-10-30). This document is the backend design and frontend integration baseline. `[Confirmed]` means explicitly stated in a planning document; `[Proposal]` means an architectural recommendation for implementation; `[Unresolved]` means a source conflict, placeholder, or pending decision/validation. Legal documents are drafts and are not stated as binding requirements before legal review.
> The source planning documents remain unchanged. WBS/TODO are authoritative for API details and page work; ERD for tables, columns, and relationships; and the policy definition for limits, states, and permissions.
## 1. Document Purpose and Design Principles
**1.1 Purpose and Scope** Linker connects developer team discovery, GitHub-based collaboration, portfolio sharing, and developer networking in one flow. The backend receives BFF requests from the Next.js website and WebView, processes core domain rules and data, and integrates with GitHub, Toss Payments, email, push, and file storage.
This blueprint summarizes system boundaries, domain responsibilities, authentication and authorization, database/API relationships, external event handling, personal-data lifecycle, and unresolved decisions based on the latest planning documents. Changing production source code, the database, APIs, or deployment environment is outside this document task.
**1.2 Labels and Source Priority**

| Label | Meaning |
|---|---|
| `[Confirmed]` | Explicitly specified in a source planning document. Technical validation may still be required before implementation. |
| `[Proposal]` | An architecture or operations recommendation for implementing source requirements; not a product decision. |
| `[Unresolved]` | A conflict, placeholder, or pending product, technical, or legal decision in the source documents. |
| `[Required]` / `[Included]` | TODO/WBS schedule categories. These are separate from PRD priority. |
| PRD `P0`–`P3` | Feature importance/release-stage categories. They are not equivalent to TODO/WBS `[Required]` / `[Included]`. |
| ERD `🟢` / `🟡` | MVP-required / MVP-included table categories, based on the MVP definition and each ERD table label. |
Resolve conflicts according to each document's role: PRD for feature purpose/IDs; MVP definition for launch scope; policy definition for rules; ERD for tables; WBS for paths, methods, WBS permissions, and controllers; TODO for screen paths and work order; frontend blueprint for frontend code conventions; README for actual project structure and environment assumptions. Do not assume this priority automatically resolves a conflict; track it in Section 20.
**1.3 Design Principles**
1. **Spring Boot is the final authority for domain behavior.** It validates authentication/authorization, ownership, team roles, limits, state transitions, subscription benefits, data changes, and transactions.
2. **The BFF is a presentation boundary.** It is limited to request forwarding, cookie transfer, response composition, and frontend error normalization. It does not duplicate business rules, access the database, or take over external integrations.
3. **GitHub is the source of truth for organizations, repositories, issues, and PRs.** Linker-owned accounts, teams, applications, chats, posts, subscriptions, and moderation state are owned by the Linker database. GitHub data is kept distinct from its cache and sync state.
4. **Do not implement features outside the MVP early.** For later phases, consider extension points only; do not add their functionality or tables to the MVP.
5. **Refer to the policy definition as the source for numeric limits and rules.** Duplicated values are convenience copies only; preserve whether the source policy is tentative or confirmed.
6. **Do not assume a distributed transaction across external systems and the database.** Use idempotency keys, sync-job state, webhook deduplication, retries, and reconciliation procedures.
7. **Design for both data minimization and auditability.** Do not log tokens, passwords, message bodies, or email addresses; audit administrator access and actions.
## 2. Service Structure and User Types
**2.1 Actors and Trust Boundaries**

| Actor | Identity/authorization source | MVP access |
|---|---|---|
| Guest visitor | No session; public API | Read public developer profiles, posts, recruitment posts, and feed. Login is required for writes and reactions. Search-engine exposure follows POL-A-9. |
| Developer | GitHub authentication; `users.user_type=DEVELOPER` | Profile, social, team discovery, teams, issues, chat, subscriptions, job-seeking status. |
| Recruiter | Verified company-domain email and password; `RECRUITER` | View feed/public profiles, message developers whose job status allows offers, Scout ads and subscription. |
| Operator | Developer account + `admins` row + OTP | Reports, content/user actions, and audit. The operations lead has additional privileges such as permanent suspension, sanction reversal, and appeal review. |
| GitHub | OAuth, GitHub App installation, webhooks | Source of truth for user identity, organizations, repositories, issues, Projects, and PRs. |
| Toss/email/push/storage | Server-held secrets and provider credentials | Test payments, recruiter email verification/password reset, Android push, and image storage. |
`public` does not mean guest-only. Optional authentication can add the signed-in user's like/follow/application state to the same read response. Recruiter profiles are not exposed to search engines.
**2.2 Service Areas and PRD Traceability**

| Area | Main responsibilities | MVP feature IDs / pages |
|---|---|---|
| Account/Auth/Profile | GitHub login, onboarding/consent, profile/tags, contribution calendar inclusion, job-seeking status | A-1–A-6, A-9, H-4 / 01–06 |
| GitHub Integration/Team | App installation, team/org/repository linking, invitations, members, completion | T-1–T-4 / 07–10 |
| Issue/Project | GitHub issue/Projects cache, create/assign/label/status/date/calendar | I-1–I-5, included T-7 / 11–15 |
| Chat/Message/Notification | Team/direct chat, requests, PR events, share cards, notifications/push, Flex summaries | C-1–C-5, C-7, N-1 / 16–18 |
| Recruit/Application | Recruitment posts, applications/joining, headcount | R-1–R-4 / 19–21 |
| Post/Feed/Social | Portfolio posts, feed/reactions/follows/link sharing, ad insertion | P-1–P-5, P-7 / 22–24 |
| Moderation/Admin | Reports/blocks/hiding/sanctions/appeals/audit | O-1–O-5 / 25–27 |
| Subscription/Billing | Pro/Flex/Scout payment, benefits, cancellation, analytics | S-1–S-10 / 28–30 |
| Recruiter/Hiring | Email signup, offers and sent-offer list, ad registration | H-1, H-3, H-5, H-7–H-9 / 31–33 |
| File/Upload | Presigned upload, validation/resizing/EXIF removal, storage metadata | Shared 00, used by P/C/I |
| Legal/Agreement | Required/optional consent versions and per-user consent history | A-1, 02–03, 06 |
Do not present a separate `Project` domain, independent recruiter-search service, or company verification API as confirmed functionality when it is absent from the MVP documents. Project completion currently uses `team_completions` and `completion_records`; Linker recruitment uses `recruit_posts` and `applications`.
## 3. Latest MVP Scope and Requirements Traceability
**3.1 MVP Scope Classification** The MVP definition determines what is included in the first release. Since PRD P0/P1 and TODO/WBS labels coexist for different purposes, the following classification follows the MVP definition itself.

| MVP category | Core features |
|---|---|
| Required | A-1–A-3, A-5, A-9, H-4; P-1, P-2, P-4, P-5; R-1–R-4; T-1–T-4; I-1–I-4; C-1, C-3, C-4, N-1; O-1–O-3, O-5; S-1–S-3 |
| Included | A-4, A-6; P-3, P-7; I-5; C-2, C-5, C-7; O-4; S-4–S-10; H-1, H-3, H-5, H-7–H-9 |
| Excluded/later phases | A-7, A-8, P-6, P-8, P-9, R-5, T-5, T-6, I-6–I-8, N-2, C-6, H-2, H-6, and Phase 4 ad analytics/multiple ads/expanded ad targeting |
In the MVP definition, “Required” means the core flow would break without it (PRD P0); “Included” means it is planned but may move to immediately after launch if the schedule slips (PRD P1). However, TODO/WBS may label individual work items `[Included]` differently from the MVP feature table. For example, the MVP launch criteria require a Scout ad demo, while the WBS schedule risk response defers ads first. The product owner must decide which features block launch.
**3.2 User Flows and Backend Responsibilities**

| User flow | Backend responsibility | Requirements / pages |
|---|---|---|
| GitHub login → required consent → onboarding | Validate OAuth state/callback, handle duplicate accounts, record consent, issue/refresh/revoke sessions, enforce account-state access | A-1–A-3, A-9 / 01–03 |
| Install GitHub team → create team/board/repository links | Revalidate installation ID server-side, enforce one-team-per-organization constraints, handle members/permissions, enqueue initial sync | T-1–T-3 / 07–10 |
| Create/update issues, status, calendar | Check user/repository write permission, validate input/team permissions, track GitHub/Projects follow-up sync | I-1–I-5 / 11–15 |
| Team discovery → apply → accept → join | Handle application/headcount races; atomically update membership, team-chat participation, and notifications; track GitHub invitation separately | R-1–R-4 / 19–21 |
| Portfolio post → feed → comments/follows/chat share | Verify public repository and upload ownership, content visibility, block relationships, and source visibility when composing cards | P-1–P-5, P-7 / 22–24, 17 |
| Team/direct chat, notifications, PRs | Check room membership/request state, deduplicate retries, authorize STOMP, deduplicate webhooks, enqueue pushes | C-1–C-5, C-7, N-1 / 16–18 |
| Report → action → appeal | Prevent duplicate reports, apply temporary hiding, restrict chat evidence, separate staff roles, append audit records | O-1–O-5 / 25–27 |
| Payment → benefit → cancellation/expiry | Do not activate benefits before server confirmation; validate plan/owner; evaluate entitlement; make Toss events idempotent | S-1–S-10, H-5 / 28–30 |
| Hiring offer/ad | Email verification, job-status and daily-limit checks, message requests, Scout subscription, ad targeting/URL/frequency rules | H-1, H-3, H-5, H-7–H-9 / 04, 05, 17, 24, 28–33 |
**3.3 Requirements Traceability Rules** Use PRD feature IDs to connect screens, APIs, entities, and policy rules. P0/P1 are PRD priorities; `[Required]`/`[Included]` are TODO/WBS categories; `🟢`/`🟡` are ERD delivery stages. If a feature spans multiple APIs or tables, represent all links in the relevant inventories. Do not mix later-phase features into MVP WBS/ERD lists.
## 4. System Architecture
**4.1 Logical Architecture**

```text
[Desktop / Mobile Browser]          [Expo WebView]
            \                          /
             \---- same Next.js UI ---/
                          |
               same-origin HTTPS / BFF
                          |
        +-----------------+--------------------+
        |                  |                   |
   Next Route Handler   RSC server adapter   `/ws` ingress route
        |                  |                   |
        +---------- Spring Boot API -------- STOMP/WebSocket
                           |
       +-------------------+-------------------------------+
       |                   |                 |             |
 PostgreSQL             Redis       GitHub / Toss     Email / Push
                                      Object Storage / AI adapter
```
`[Confirmed]` The service uses a responsive Next.js website and an Expo WebView app with the same screens, Spring Boot/Java, Spring Data JPA, PostgreSQL, Redis, REST/OpenAPI, and GitHub/Toss/email/push integrations. README is a collection of planning documents; it does not confirm the actual backend app structure, versions, or runtime environment. Hosting and region decisions are listed in Section 20.
**4.2 Runtime Boundaries**
- **Next.js UI/BFF:** Serves the same website and WebView screens, receives same-origin HTTP requests, forwards only approved headers/cookies to Spring, composes screen responses, and normalizes user-facing errors.
- **Spring Boot:** The sole owner of business rules, authorization, data persistence, transactions, external API integrations, and asynchronous processing; **PostgreSQL:** Persistent store for the 69 MVP ERD tables. The BFF must not access the database directly.
- **Redis:** Policy rate limits, temporary sync/job queue infrastructure, caches, STOMP sessions, and temporary ad daily counters. It is not the source of persistent data; **Object Storage:** Stores image binaries. The database keeps keys and metadata in `uploaded_files`. Provider is undecided.
- **Edge/Ingress:** Handles HTTPS/TLS, internal web/API routing, and `/ws` WebSocket upgrades. Keep BFF/browser routes separate from internal Spring API paths.
## 5. BFF Architecture and Frontend Integration
**5.1 Recommended Structure**

```text
apps/
  web/
    src/
      app/api/bff/[...path]/route.ts    # Browser/WebView HTTP BFF
      lib/api/api-fetch.ts              # Shared mutator; do not expose Spring URL to clients
      lib/api/bff-fetch.ts              # Server-only adapter for server components
      lib/api/api-error.ts              # Shared error normalization
      features/                         # Add screen composition functions only when needed
  mobile/                               # Expo WebView shell for the Next.js screens
packages/
  api/generated/                       # Orval-generated code
  bridge/                               # Web↔app message types and native actions
```
This structure is a `[Proposal]`. The frontend blueprint defines the monorepo as `apps/web`, `apps/mobile`, `packages/api`, and `packages/bridge`, with `api-fetch.ts` under `apps/web/src/lib/api/`. It does not currently include a BFF Route Handler directory. Therefore, reconcile the proposed `packages/api/generated` with the source convention for `packages/api` and generated code. This task does not modify the frontend blueprint.
**5.2 Communication Patterns and Recommendation**

| Pattern | Advantages | Cost/risk | Recommended use |
|---|---|---|---|
| Generic BFF proxy for every Spring API | Consistent auth/error/header policy, hides Spring origin from browsers, quick to adopt | Requires path/method allowlists and body-size limits. An arbitrary-URL proxy risks SSRF and confused-deputy issues. Does not compose screen data. | **Default.** Explicit pass-through with fixed prefixes, allowed methods/headers, and request-size limits. |
| Screen-specific BFF aggregation APIs | Parallelizes calls and returns a screen DTO in one round trip | Can duplicate API/cache/error contracts around screens; adds OpenAPI maintenance | Add selectively when latency or duplicate calls are observed. Keep domain decisions and write rules in Spring. |
| Direct Spring API calls | Matches the existing frontend design and is simple | Depends on browser CORS and shared-domain cookies; exposes Spring origin; server and browser calls differ | Do not use for browser HTTP after BFF adoption. Webhooks and WebSocket remain separate boundaries. |
**Recommendation:** Route browser/WebView HTTP through same-origin `/api/bff/...`. Keep WBS as the source for Spring REST APIs. Add screen-specific aggregation functions/endpoints only where they have a clear purpose. Never build an open proxy that fetches a client-supplied URL.
**5.3 Request Forwarding Contract**
- Forward only allowlisted Spring API prefixes and `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`. The BFF must not invent Spring APIs absent from the WBS.
- Forward query parameters, body, `Content-Type`, approved `Accept`, `If-None-Match`, and other required headers. Strip `Host`, `Connection`, arbitrary `Forwarded`, and hop-by-hop headers. Never trust client-supplied user ID/role headers for Spring authentication; Preserve response status and safe headers. Preserve `Set-Cookie` correctly for OAuth/refresh/logout, and validate cookie domain/path per environment.
- Do not assume every Spring response is JSON. Preserve type and size for 204, image/file, download, and streaming responses; handle these paths separately; Preserve Spring errors shaped as `{code,message,detail}`. Separate user-facing text from internal errors/stack traces. Convert BFF network failures to a fixed error envelope with a correlation ID.
- Cache GET requests only by explicit policy. Never share-cache cookie-authenticated or personalized responses. Define keys and `Cache-Control` only for public unauthenticated responses, and separate Next.js server-cache ownership from Spring domain-cache ownership; Isolate per-request user/cookie context when server-side requests run in parallel so cookies and responses cannot cross users.
**5.4 Authentication Cookies and Session Flow** **Recommended flow:** Do not expose JWT/refresh tokens to browser JavaScript, URLs, or the app bridge. The Next.js BFF forwards request cookies to Spring and relays `Set-Cookie` from login/refresh responses to the browser. Spring validates the token/session/account state on every request. Passing through the BFF does not complete authentication or authorization.

```text
GitHub OAuth → Spring authorize/callback handling → BFF sets httpOnly session cookie
Browser → same-origin BFF → Spring (forwards approved Cookie)
Next RSC → server-only BFF adapter → Spring (forwards request user's Cookie)
Logout → BFF → Spring revokes session/refresh → expired Set-Cookie returned
Token expiry → BFF makes/forwards at most one restricted refresh call → define concurrency/retry behavior
```
`[Unresolved]` The source documents do not settle the cookie issuer/format, access/refresh separation, rotation/reuse detection, JWT vs opaque session, or Domain/Path/SameSite/lifetime. The frontend blueprint proposes `HttpOnly; Secure; SameSite=Lax`, a parent-domain cookie, and asymmetric JWT claims (`sub`, `typ`, `adm`, `onb`, `st`). With a BFF, a same-origin host-only cookie may be possible, so decide domain, OAuth, and WebSocket behavior together. Since browsers automatically attach cookies, protect state-changing requests with CSRF defenses (CSRF token or strict Origin/Referer validation plus SameSite design).
**5.5 Browser, Server Component, and WebView Calls**
1. **Browser → BFF → Spring:** The Orval mutator calls relative `/api/bff/...`; the same-origin httpOnly cookie is sent automatically. This removes browser dependence on Spring API CORS.
2. **Next server component → Spring:** Do not have a server component call its own Route Handler. A shared server-only BFF adapter reads the request cookie and calls the private Spring origin directly. Share authorization/error/header allowlists with the browser BFF. Public cookie-free SEO data may use a separate cached function.
3. **Expo WebView → BFF → Spring:** Use the same Next.js domain, screens, and BFF. Keep the session in the WebView cookie store. The native bridge handles login return, sharing, and push permissions only; it never passes session JWTs. Validate iOS `sharedCookiesEnabled` and cookie persistence after returning to the app on a device.
4. **Login callback:** Validate OAuth `state`/PKCE and an allowlisted `returnTo`; the server exchanges the code. Follow the frontend flow where the app returns to the WebView via a deep link after system-browser authentication. Verify the callback response cookie is saved by the WebView.
5. **Refresh/logout:** Forward WBS `POST /api/v1/public/auth/refresh` through the BFF and preserve `Set-Cookie`. Confirm logout API/session revocation against the WBS before settling the flow. Never log tokens or place them in URLs.
6. **Orval/OpenAPI:** Keep Spring OpenAPI generated from the WBS as the upstream API contract. Configure the `packages/api` mutator to use the BFF URL in browsers; use a server-only adapter on the server. A one-to-one BFF proxy does not need a duplicated spec. Manage screen aggregation BFF contracts in a separate OpenAPI document/schema.
7. **`API_BASE_URL`:** Keep the Spring origin in a server-only environment variable. Do not expose it through `NEXT_PUBLIC` or a browser-used `API_BASE_URL` as the frontend blueprint currently does. The public BFF URL is a same-origin relative path.
**5.6 Security, CORS, Errors, and Caching**
- **CSRF:** Apply CSRF tokens or strong Origin checks to cookie-authenticated state changes. Do not treat `SameSite=Lax` alone as complete protection. Validate OAuth callbacks with state/PKCE.
- **CORS:** Same-origin browser REST through the BFF can minimize Spring's CORS allowlist. Configure separate origin allowlisting/authentication for WebSocket. Validate WebView/app domains in deployment settings; **Headers/cookies:** Allowlist forwarded headers, set size limits, filter cookie headers, correctly handle multiple `Set-Cookie` headers, and redact `Authorization`/GitHub tokens. Do not trust user-supplied `X-User-Id`/role.
- **Errors:** Preserve the WBS envelope `{code,message,detail}`. Normalize 401 refresh, 403 permissions/plans, 404 private/deleted resource behavior, 409 state conflicts, 429 policy limits, and 502/503 dependency failures. Never expose SQL, stack traces, tokens, or personal data in errors; **Caching:** Default authenticated screen requests to `no-store`. Cache public GET only by explicit policy and prevent user-specific likes/blocks/applications from leaking. Define Next.js public-cache ownership separately from Spring source/domain caches.
- **Files:** Small requests and presigned URL issuance can pass through the BFF. Decide separately whether Next Route Handlers proxy large byte streams or clients PUT directly to storage with presigned URLs. Spring validates file permissions, upload completion, and deletion.
**5.7 Communications Outside the BFF**

| Communication | Through BFF? | Authentication/processing boundary |
|---|---|---|
| Browser/WebView REST | Yes | Same-origin BFF; Spring performs final validation. |
| Next server component REST | Server-only adapter calls Spring | Forward the request user's cookie server-side. Do not shared-cache cookie-bearing responses. |
| GitHub OAuth callback | BFF for start/web UI; Spring validates/exchanges OAuth code | State/PKCE, allowlisted callback/returnTo, secure cookie setting. |
| GitHub webhook → Spring | No | Direct to public Spring webhook ingress; verify signature/delivery ID and respond quickly. |
| Toss approval/webhook → Spring | No | Server verifies payment approval and webhook signature; order/payment idempotency. |
| STOMP WebSocket | Not through generic HTTP BFF | Ingress upgrades `/ws` to Spring WebSocket. Choose cookie auth or one-time ticket; validate origin, subscription ACL, reconnect, and recovery. |
| File upload | Recommended: file bytes direct to storage; control through BFF→Spring | Presigned URL/file ID ownership, MIME/size/image validation, completion verification. |
| Android push | Client→BFF→Spring for token registration; Spring calls provider | Spring alone holds Expo/FCM server keys. Native bridge requests permission and forwards device token. |
| Email/AI/GitHub API | No | Spring adapters use server secrets. AI enforces Flex entitlement, input scope, and retention policy. |
**Separate STOMP note:** The frontend blueprint describes direct browser connections to Spring STOMP authenticated with the same cookie. A REST Route Handler does not provide WebSocket upgrade proxying. The recommendation is for ingress to route same-site `/ws` to Spring and forward the cookie. Align domain, cookie path/domain, and Origin policy. Alternatively, Spring could issue a short-lived one-time STOMP ticket; this is a new API proposal and is not in the WBS. Revalidate team/room authorization on each subscription and use REST to sync messages after the last seen ID on reconnect.
## 6. Backend Domains and Package Structure
**6.1 Recommended Spring Package Boundaries**

```text
com.linker
  api/            # WBS page controllers, request/response DTOs
    common/       # Shared page 00 foundation
    p01_login/ ... p33_recruiter_offer/
  domain/         # Shared business rules, entities, repositories
    account, profile, github, team, issue, chat, notification,
    recruit, post, feed, moderation, subscription, recruiter, file, legal
  integration/    # GitHub/Toss/email/push/storage/AI adapters
  async/          # Webhook consumers, outbox/retry, schedulers
  global/         # Security, errors, validation, rate limits, config
```
This respects the WBS one-controller-per-page rule without duplicating domain services/entities/repositories for each controller. `api.pNN_*` naming and Orval `@Tag` are part of the frontend's expected contract; coordinate any adjustment with the BFF follow-up work.
**6.2 Domain Responsibilities and External Boundaries**

| Domain | Responsibility/core data | Authorization/transactions/integrations |
|---|---|---|
| Account/Auth/Legal | `users`, `auth_identities`, `github_tokens`, `user_sessions`, `user_agreements`; OAuth/email login, consent, sessions, withdrawal | Centralize login/account state; encrypt tokens; revoke/refresh sessions. OAuth/email integration. |
| User/Profile | `tech_tags`, `user_tech_tags`, `contribution_days`, `recruiter_profiles`, `email_verifications`, etc. | Control personal-field visibility, job status, profile access. GitHub API/email. |
| GitHub Integration | `github_installations`, `github_repos`, `github_webhook_deliveries`, GitHub caches | Separate installation-token and user-token permissions; API rate limits; idempotent webhook handling. |
| Team/Workspace | `teams`, `team_members`, `team_repos`, invite/board/completion tables | MEMBER/ADMIN/OWNER, organization/team limits, app-removal state. Recruitment acceptance joins in the same DB transaction. |
| Issue/Project | `issues`, assignees/labels/sync jobs/PRs/progress snapshots | Team membership and repository write permission; GitHub/Projects sync jobs. GitHub remains source of truth. |
| Chat/Message | `chat_rooms`, memberships, messages, images, mentions, included `ai_chat_summaries` | Membership/DM request/block/read/search policies. Persist message before delivery. |
| Notification | `notifications`, `push_tokens` | Separate notification creation from delivery; recipient/quiet hours/deduplication. Expo/FCM. |
| Recruit/Application | `recruit_posts`, `recruit_roles`, tags, `applications` | Author/team permission, application/acceptance races, state notifications. |
| Post/Feed | Posts/images/links/tags, likes/comments/follows, feed/view stats | Visibility/deletion/block filters. Separate optional authentication in public responses. |
| Moderation/Admin | Reports/cases/snapshots/sanctions/appeals/admins/actions/blocks | Role-specific operations, admin OTP, sensitive-access audit. Transactional actions with append-only audit. |
| Subscription/Billing | `subscriptions`, `payments`, entitlement rules | Validate plan/owner; idempotent approval/cancellation/expiry/refund. Toss integration. |
| Recruiter/Hiring | Email-verified profile; offers use `chat_rooms.request_kind`; ads/hides/daily stats | Recruiter-only, job status/daily limits/ad validity and targeting. |
| File/Upload | `uploaded_files` plus Object Storage binaries | Presigned issuance/completion/ownership checks; cleanup/retention jobs. |
External calls should generally be separated from short application-service transactions. For external-success/internal-write divergence, track state/idempotency keys and provide reconciliation. Do not hold DB row locks during long external calls.
## 7. Database and ERD
**7.1 ERD Scope and Principles** The MVP schema in `08-ERD.md` contains **56 required 🟢 + 13 included 🟡 = 69 tables**. Do not merge or remove tables. ERD Sections 3–5 are authoritative for columns, keys, foreign keys, and constraints.
- PostgreSQL + Spring Data JPA; `id bigint identity`; shared `created_at`/`updated_at` (`timestamptz`); string enums; separate mapping tables; Separate user-content soft deletion via `deleted_at` from moderation `visibility` (`VISIBLE`, `UNDER_REVIEW`, `HIDDEN`). Physically delete after the retention period using jobs.
- Represent GitHub-source values with cache tables/`github_*` fields and update via webhooks and periodic sync. Ignore stale events using GitHub IDs/repository-scoped uniqueness and source `updated_at`; Keep Linker-owned posts/messages/applications/subscriptions/moderation separate from GitHub caches.
- Prevent concurrent user/event conflicts with DB unique constraints and atomic conditional updates. Validate ERD-proposed partial unique indexes for active team members and duplicate applications; Store timestamps in UTC; align policy date boundaries and batch timezone with the ERD/policy, including KST where specified.
**7.2 Complete MVP Table Inventory** The inventory below preserves all MVP tables in the ERD, grouped by domain. The ERD remains authoritative for exact columns, constraints, and relationships.

| Domain | Tables (ERD labels) | Features |
|---|---|---|
| Account/Profile | `users`🟢, `auth_identities`🟢, `github_tokens`🟢, `user_sessions`🟢, `user_agreements`🟢, `tech_tags`🟢, `user_tech_tags`🟢, `username_redirects`🟡, `contribution_days`🟡, `recruiter_profiles`🟡, `email_verifications`🟡 | A-1–A-5, H-1, H-4 |
| Files/Portfolio/Social | `uploaded_files`🟢, `posts`🟢, `post_images`🟢, `post_demo_links`🟢, `post_tags`🟢, `post_likes`🟢, `comments`🟢, `follows`🟢, `feed_seen_posts`🟢, `pinned_posts`🟡, `profile_visits`🟡, `post_views`🟡 | P-1–P-5, P-7, A-6, S-4, S-10 |
| Team Discovery | `recruit_posts`🟢, `recruit_roles`🟢, `recruit_post_tags`🟢, `applications`🟢 | R-1–R-4, S-5 |
| Team/GitHub | `github_installations`🟢, `github_repos`🟢, `github_webhook_deliveries`🟢, `teams`🟢, `team_members`🟢, `team_repos`🟢, `team_invite_links`🟢, `github_org_invitations`🟢, `team_ownership_transfers`🟢, `team_project_boards`🟢, `board_status_mappings`🟢, `team_completions`🟢, `completion_records`🟢 | T-1–T-4, A-5 |
| Issues/PRs | `issues`🟢, `issue_assignees`🟢, `issue_labels`🟢, `issue_sync_jobs`🟢, `pull_requests`🟢, `team_progress_snapshots`🟡 | I-1–I-5, C-3, T-7 |
| Chat | `chat_rooms`🟢, `chat_room_members`🟢, `chat_messages`🟢, `chat_message_images`🟢, `chat_message_mentions`🟢, `ai_chat_summaries`🟡 | C-1–C-5, C-7, P-7, S-6/S-8, H-3 |
| Notifications | `notifications`🟢, `push_tokens`🟢 | N-1 |
| Trust/Safety/Operations | `user_blocks`🟢, `reports`🟢, `report_cases`🟢, `report_message_snapshots`🟢, `sanctions`🟢, `appeals`🟢, `banned_github_ids`🟢, `admins`🟢, `admin_actions`🟢 | O-1–O-5 |
| Subscriptions/Payments | `subscriptions`🟢, `payments`🟢 | S-1–S-3, S-7, H-5 |
| Hiring Ads | `user_job_categories`🟡, `recruiter_ads`🟡, `ad_hides`🟡, `ad_daily_stats`🟡 | H-7–H-9 |
**Outside the MVP:** Do not include later-phase tables from ERD Section 9 here. When a feature moves into scope, update PRD/MVP/WBS/ERD together.
**7.3 Core Consistency and Index Checks** Verify ERD constraints in migrations/implementation. Representative examples: unique provider identity in `auth_identities`; unique `users.username` and old-username redirect period; unique active team membership; team-per-installation constraints; unique `(repo_id, issue_number)`; no duplicate `posts(author_id, repo_id)`; composite uniqueness for reactions/follows; normalized direct-chat `dm_key`; client message ID; webhook delivery ID; payment `order_id`/payment key; one ad per recruiter and daily aggregation key. Do not assert indexes absent from the ERD without query-plan evidence.
- **Application acceptance:** Use a role-row lock or conditional update to prevent concurrent acceptance of the final opening. Atomically commit application status, accepted count, team membership, chat membership, and internal notification. Send GitHub organization invitations as separate external jobs with failure state; **Messages:** Use `client_message_id + sender_id` to deduplicate retries and increasing IDs for ordering/read cursors. If STOMP delivery fails after DB persistence, recover by re-query/re-delivery.
- **Team completion:** Derive member completion records, undo window, and finalization under POL-T-4. Leave calculation edge cases unresolved in Section 20; **Subscriptions:** Recover from duplicate approval callbacks, webhook retries, or internal-write failures after provider approval by querying/reconciling provider order state.
- **Ads:** Follow the ERD rule that per-user impressions are not persisted; aggregate Redis daily counters into `ad_daily_stats` once a day.
**7.4 Data Outside the Database and Personal-Data Lifecycle**

| Data | Storage/retention basis | Design handling |
|---|---|---|
| API limits, temporary ad stats, chat sessions | Redis with TTL | Short-lived policy counters; account for expiry/restart. Not a source of durable state. |
| GitHub README/templates/labels | Redis cache; ERD specifies 1-hour README cache | GitHub remains source; indicate cache freshness when serving stale data. |
| Drafts in progress | Device storage; policy says delete after 7 days | Do not store on backend. |
| Image binaries | Object Storage | Keep metadata only in DB; implement deletion/backup purge lifecycle. |
| GitHub tokens/refresh sessions | Encrypted/restricted | Delete GitHub tokens immediately on withdrawal/disconnect; redact logs. |
| Account data | Policy draft: 30-day withdrawal grace, then deletion/anonymization | Define how to retain `users` FK while removing personal fields. |
| Posts/comments/photos | Remove immediately from service on deletion; draft allows up to 30 days in backups | Soft-delete then purge job/backup lifecycle validation. |
| Team chat | Retain while team exists; show withdrawn author as “Deleted user” | Legal review needed for other members' record rights vs deletion requests. |
| Direct chat | Delete after both participants leave; image original draft says 1 year | Validate actual message/attachment purge and both parties' rights. |
| Reports/sanctions | Draft: 1 year after handling; permanently banned GitHub ID `[N years]` unresolved | Keep evidence snapshots minimal; restrict access and audit. |
| Payment records | Terms draft mentions statutory retention such as 5 years | Apply after legal review and confirmation of Toss data; never store card number. |
| Access/usage logs | Draft: IP/login 3 months; service logs 90 days | Separate purposes, redact sensitive fields, schedule deletion. |
| AI results | Draft: 7 days; shared chat cards follow chat retention | Do not send externally until AI provider, training, and transfer scope are settled. |
## 8. API and Controller Design
**8.1 WBS Source Rules and Counts** `09-WBS.md` is authoritative for Spring REST paths, HTTP methods, roles, pages, and assignments. Its 2026-10-30 overview reports **40 controllers (33 page + 7 shared), 204 REST endpoints, and 69 tables**. The detailed REST endpoint rows and per-controller endpoint counts both sum to **204**, matching the overview. The 5 shared realtime paths comprise 1 WebSocket connection endpoint, 1 STOMP SEND destination, and 3 SUBSCRIBE destinations (WBS pages 16–18).

| Role | Who may call | Final Spring rule |
|---|---|---|
| `public` | Public reads/login entry, including guests | `permitAll` + optional authentication as needed; IP rate limit for public reads. |
| `user` | Any authenticated user | `authenticated`; apply separate developer-only checks where required. |
| `recruiter` | Recruiters | Validate `RECRUITER` user type and account state. |
| `admin` | Operators | Validate `admins` registration, OTP, and operations role. |
| `webhook` | GitHub webhook | Verify GitHub signature/delivery instead of user session. |
In the WBS `/api/v1/{role}/{resources}` pattern, a team is a resource, not a role. Validate `/api/v1/user/teams/{teamId}/...` with `@TeamRole(MEMBER|ADMIN|OWNER)`. Apply `@DeveloperOnly` to developer-only writes. The subscription service validates plan ownership (PRO/FLEX for developers, SCOUT for recruiters). Public reads may be personalized when a cookie is present, but must be separated from shared cache.
**8.2 Controller List**

| Owner | Area | Pages | Controller | WBS roles / main API areas |
|---|---|---|---|---|
| — | Shared foundation (not assigned to an owner) | Shared 00 | `AuthSessionController`, `TechTagController`, `UploadController`, `ReportController`, `BlockController`, `GithubWebhookController`, `SitemapController` | user/public/webhook; sessions, shared tags, uploads, reports, blocks, webhook, sitemap |
| B·C | GitHub/Team/Operations (B) / Issues (C) | 07 | `WorkspaceController` | B: team list and workspace functions; C: “my issues” query function |
| B·D | GitHub/Team/Operations (B) / Chat/Notifications/Subscriptions (D) | 17 | `ChatRoomController` | D: rooms, messages, STOMP and chat functions; B: PR posting function |
| A | Account/Hiring | 01–06, 25, 31–33 | `LoginController`, `OnboardingController`, `LegalController`, `ProfileController`, `ProfileEditController`, `SettingsController`, `AdminReportController`, `RecruiterSignupController`, `RecruiterLoginController`, `RecruiterOfferController` | Login, consent, profile, settings; report handling; recruiter verification/login/sent offers |
| B | GitHub/Team/Operations | 08–10, 26–27, 30 | `TeamCreateController`, `TeamSettingsController`, `InviteController`, `AdminUserController`, `AdminAuditController`, `StatsController` | Team creation/settings/invites; user actions/audit records; personal stats |
| C | Issues | 11–15 | `IssueListController`, `IssueDetailController`, `IssueCreateController`, `BoardController`, `CalendarController` | Issue list/detail/create, board, calendar, progress status |
| D | Chat/Notifications/Subscriptions | 16, 18, 28–29 | `ChatListController`, `NotificationController`, `SubscribeController`, `SubscriptionManageController` | Chat list; notifications; subscription/payment/management |
| E | Team Discovery/Portfolio | 19–24 | `RecruitListController`, `RecruitEditorController`, `RecruitDetailController`, `PostEditorController`, `PostDetailController`, `FeedController` | Recruitment posts/applications/decisions; portfolio posts/detail/feed/ads |
WBS assigns one controller per page as an API assembly boundary. Do not split domain services/entities by controller. Controllers with multiple roles (`04`, `05`, `06`, `10`, `17`, `19`, `21`, `23`, `24`, etc.) should authorize at the method level rather than class level.
**8.3 API Areas and Representative Paths** Representative paths illustrate actual WBS route patterns; they are not the full API contract. WBS detailed tables and OpenAPI are authoritative for every route/method/role/request/response/success/failure code.

| API area | Representative path/method | Authorization/policy |
|---|---|---|
| Auth/session | `GET /api/v1/user/me`, `POST /api/v1/public/auth/refresh`, OAuth authorize/callback routes | public/user; state, PKCE, cookies |
| Upload/report/block | `POST /api/v1/user/uploads`, `POST /api/v1/user/reports`, `POST/DELETE /api/v1/user/blocks/{userId}` | user; file ownership/policy checks |
| Profile | `GET /api/v1/public/users/{login}`, `PATCH /api/v1/user/me/profile` family | public/user/recruiter; minimize response fields |
| Teams | `/api/v1/user/teams`, `/api/v1/user/teams/{teamId}/members` family | user + team role; separately validate GitHub permission |
| Issues | `/api/v1/user/teams/{teamId}/issues` and `/issue-sync-jobs/{jobId}` | Team member/repository permission; separate external sync state |
| Chat | `/api/v1/user/chat-rooms/{roomId}/messages`, `/share-cards`, `/ai-summaries` | Room membership/request state/subscription limits |
| Recruitment/applications | `/api/v1/public/recruits`, `/api/v1/user/recruits/{id}/applications` family | public read/user write; transactional role headcount |
| Posts/feed | `/api/v1/public/posts/{postId}`, `GET /api/v1/public/feed?cursor=&offersOnly=`, `POST /api/v1/user/posts` | Public read/optional auth; author/block/visibility checks |
| Ads | `/api/v1/user/ads/{adId}/click` and hide/dismiss APIs | Developer; job-category/Scout/frequency checks |
| Operations | `/api/v1/admin/report-cases`, `/api/v1/admin/users`, `/api/v1/admin/audit` family | Admin/operations-lead separation and OTP |
| Payments | `GET /api/v1/user/plans`, `POST /api/v1/user/payments/checkout`, `/confirm`, `GET /api/v1/user/me/subscriptions` | Validate user type/plan owner; server-side approval |
| Recruiters | `/api/v1/recruiter/offers`, `/api/v1/recruiter/chat-requests` | recruiter; company email verification/daily offer limits |
| GitHub webhook | `POST /api/v1/webhook/github` | Signature/delivery deduplication |
List APIs follow the WBS cursor convention `?cursor=&size=20` → `{items,nextCursor}`. Success returns the body directly by default, `201` for creation, and `202` for asynchronous acceptance. Errors use `{code,message,detail}` and existing WBS codes such as `LOGIN_REQUIRED`, `DEVELOPER_ONLY`, `TEAM_ROLE_REQUIRED`, `BLOCKED_RELATION`, `RATE_LIMITED`, `PLAN_LIMIT`, `GITHUB_UNAVAILABLE`, `GITHUB_PERMISSION`, and `SUSPENDED`. Follow WBS status mappings; do not invent statuses absent from the source.
**8.4 API Contract Fields and Confidence** Track each WBS route in implementation OpenAPI using the fields below. Do not invent DTO names/schemas or per-route status codes absent from the source.

| Contract field | Latest source basis | Follow-up/unresolved |
|---|---|---|
| Path/HTTP method | WBS detailed endpoint rows | The latest WBS table is authoritative; representative paths above are not exhaustive. |
| User role | WBS `public/user/recruiter/admin/webhook` | Align with Spring method authorization. |
| Team permission | WBS `@TeamRole`/per-row MEMBER·ADMIN·OWNER | Page-specific permission is authoritative for resource exceptions. |
| Request DTO | Request fields or feature description in WBS | Explicit DTO schemas/names are not provided for every API. Define field validation in implementation/OpenAPI. |
| Response DTO | Return data/screen requirements in WBS | Formal schemas/names are not standardized for every API. Separate personal fields for public/member/recruiter/admin responses. |
| Success HTTP status | WBS common rule: direct body, 201 creation, 202 async | Confirm 200/204 for updates/deletes in each API spec; do not assume. |
| Failure HTTP status | Shared error envelope `{code,message,detail}` and examples | WBS does not provide a complete per-route 400/401/403/404/409/429/502/503 mapping. Fix in Spring OpenAPI and frontend `ApiError`. |
| Feature ID/page | Per-page WBS `basis`/feature IDs, TODO page number/path | When an API is shared, record both owner controller and consumer page. |
| ERD tables | Per-page WBS table list and ERD Sections 3–5 | Mark read caches/external sources explicitly; do not infer query tables. |
The WBS details `GET /api/v1/user/me`, `POST /api/v1/public/auth/refresh`, OAuth callback, `GET /api/v1/public/feed`, Toss checkout/confirm, and `POST /api/v1/recruiter/chat-requests`, among others. This blueprint references rather than duplicates the contract. Before implementation, export OpenAPI and validate Orval mutator/BFF URL mapping.
**8.5 WBS ↔ Controller ↔ Service ↔ ERD Validation**

```text
07 TODO page/path → 09 WBS API/method/role → Spring page Controller
                   → shared Domain Service → JPA Repository → 08 ERD table
```
Connect each API to its PRD feature ID, TODO page, WBS controller, and ERD tables in a traceability matrix. Compare frontend Orval calls against WBS APIs. The BFF may compose page data, but must not invent business write APIs absent from the WBS. Keep the 204 REST endpoints aligned with the WBS detailed rows and controller totals, and verify all 5 shared realtime paths across pages 16–18.
## 9. Authentication, Authorization, and Security
**9.1 Login and Sessions**
- Developers: GitHub OAuth (PKCE required), one-time `state` validation, callback allowlist, and provider-ID account linking.
- Recruiters: company-domain email verification code (free email providers excluded), then password signup/login/reset. Hash verification/reset codes, use short TTLs and rate limits, disallow reuse, and prevent account enumeration; Passwords: one-way BCrypt hash (configure cost by environment). Never store/log plaintext or reset tokens.
- Sessions: policy draft specifies 30-day login persistence extended with use. `user_sessions` represents refresh sessions. Access-token lifetime, refresh rotation, reuse detection, concurrent-session limits, and revocation timing are unresolved; Cookies: `HttpOnly`, `Secure`, appropriate `SameSite`, and minimal Path/Domain/lifetime. Decide the BFF same-origin host-only approach together with the STOMP boundary.
- Restrict OAuth `returnTo` to internal allowed paths to prevent open redirects. Do not leave authorization codes in URLs/logs longer than needed.
**9.2 Authorization Layers** Order: validate account/session → state (suspended/pending deletion) → user type/operations role → team membership/role → resource ownership → GitHub source permission → subscription benefits/policy limits. The browser `proxy.ts` route guard is a convenience and does not replace Spring checks. If the BFF creates an auth header, Spring must validate it using a trusted server/session mechanism; reject client-supplied role/user ID headers.
- `@DeveloperOnly`: developer-only writes and Pro/Flex access; `@TeamRole`: enforce OWNER/ADMIN/MEMBER per API policy.
- `recruiter`: verify company email and RECRUITER role/account state; `admin`: `admins` registration, OPERATOR/LEAD separation, OTP, and 30-minute idle logout per policy.
- Suspended users may only log in, view, appeal, or withdraw as specified by policy. Align automatic reactivation with the service state policy; Separate guest and optionally authenticated fields in public responses. Never return private data, contact details, or recruiter profiles.
**9.3 CSRF, CORS, Secrets, and Audit**
- Apply CSRF protection and safe Origin validation to all cookie-authenticated writes/deletes. OAuth state/PKCE are separate checks.
- Use the BFF to make browser REST same-origin and reduce Spring CORS. Do not conflate REST and STOMP origin policy; Store GitHub App private keys, OAuth/Toss secrets, email/push/storage/AI keys in deployment secrets/secret manager with rotation procedures. Do not expose them in code, responses, or logs.
- Encrypt GitHub access tokens in the database. Keep encryption keys separate from the DB; key rotation/revocation remains an operations decision; Mask operator emails. Operators cannot access unreported chats; expose only O-4 snapshots within scope. Audit all sensitive reads/actions with actor, time, and reason.
- Define purpose, retention, and access rights for IP/login-time security logs through the privacy draft and legal review.
## 10. GitHub Integration and Data Synchronization
**10.1 Integration Responsibilities**

| Integration | Source/actor | Processing rule |
|---|---|---|
| OAuth | GitHub user identity | PKCE/state, server-side code exchange, link GitHub user ID to Linker account. |
| GitHub App | Organization installation/repository/issue/Projects/PR reads | Server only holds installation tokens; separate them from user-token permissions. |
| User token | User-authored issue creation, etc. | Encrypt and minimize scopes; request reauthentication if refresh fails. |
| Webhook | `issues`, `pull_request`, `projects_v2_item`, `organization`, `installation`, etc. | Verify HMAC signature, unique delivery ID, persist raw event/state, process asynchronously. |
| Cache | Linker PostgreSQL cache | Read cache for screens to protect GitHub limits; compare `updated_at` and periodically resync. |
PRD Section 8 requires user authentication (PKCE), Metadata/Contents read, Issues read/write, Organization Projects read/write, PR read, Organization Members read/write, webhook events, and `contributionCalendar`. Apply least privilege based on the actual GitHub App permission screen and validation results.
**10.2 Issues and Projects Flow**
1. Do not trust installation IDs returned from the team-install callback; re-query GitHub from the server.
2. Verify repository/board lists and member permissions, then link them to the Linker team. Explain the PRD restriction that personal GitHub Projects cannot be handled by the app.
3. Do not treat the Linker DB/Projects as the original before issue creation. Record cache/job state after GitHub issue creation succeeds.
4. If Projects-item/field/date setup is a follow-up call, return step-by-step `issue_sync_jobs` state/failure/retry status. Distinguish partial success from duplicate user retries.
5. On out-of-order webhooks, apply only the state with the newest GitHub `updated_at`. Add periodic sync/manual recovery for missed events.
6. On app removal, apply POL-T-3/ERD behavior such as READ_ONLY then archive after 30 days. Recovery after reinstall and deletion after organization removal need further decisions.
**Unresolved:** Validate Projects v2 date/Blocked representation, free-organization limits, issue-fields alternative, user-authored issue creation, and issue attachment constraints in MVP spikes. Do not imply GitHub API supports file attachments; use Linker file-storage links.
**10.3 PRs, Rate Limits, and Recovery**
- Publish only connected-repository PR created/review-requested/merged/closed events to team chat (C-3). Commit/comment alerts are outside MVP scope.
- User-token and organization-installation-token limits differ. Do not synchronously query GitHub for every screen request. Use cache, cursor pagination, ETag/revalidation, and 429 `Retry-After`; For transient errors/429, propose exponential backoff with jitter and a max attempt count, followed by operator reprocessing. Do not retry revoked permissions/404/app removal forever; update connection state.
- Verify/store/accept webhooks quickly and process asynchronously. Return idempotent success for duplicate deliveries; retain failures in a reprocessable state.
## 11. Real-Time Chat and Notifications
**11.1 Messages and STOMP**
- Messages, room membership, request state, and read cursors persist in PostgreSQL. STOMP is a delivery channel, not the source of truth.
- WBS shared realtime paths: `/ws` is the cookie-authenticated WebSocket connection endpoint; `/app/chat-rooms/{roomId}/messages` is the SEND destination; `/topic/chat-rooms/{roomId}`, `/user/queue/notifications`, and page 16's `/user/queue/chat-rooms` are SUBSCRIBE destinations. The count is 5 paths: 1 connection endpoint + 4 STOMP destinations.
- On CONNECT, validate account state, origin, and session. On SUBSCRIBE, validate room membership, block/suspension, and team role; changing the room ID must not grant access; Deliver only after message persistence. Deduplicate acknowledgements/retries with `client_message_id`. After reconnect, use REST to fill gaps after the last confirmed ID.
- Follow WBS destinations/APIs for live chat-list/unread-count updates. Never log personal data or message bodies; Direct chat is immediate for mutual follows/same-team; otherwise use message requests. Enforce accept/reject/30-day expiry/re-request limits/blocks server-side. Distinguish recruiter offers from regular DMs with `RECRUITING` request type.
**11.2 Messages, Notifications, and Push**
- Validate message/image length/count/size policies, remove image EXIF, and enforce the 24-hour edit/deletion policy.
- Policy draft retains team chat while the team exists and deletes direct chat after both leave. Flag its conflict with withdrawal/deletion rights; legal review must decide retention/anonymization; Create notification records consistently with domain changes; send provider pushes asynchronously. An outbox/retry table is a `[Proposal]` only and must not be treated as an ERD-confirmed table.
- Support multiple Expo Push/FCM tokens per user; remove on logout/withdrawal and clean invalid tokens. iOS app push is listed as outside MVP; Separate policy quiet hours, delay for non-chat alerts, and marketing consent. Do not equate in-app notification persistence with external push delivery success.
**11.3 Flex AI Chat Summary** C-5/S-8 is **Included** in MVP and available only to Flex teams (including trial). Run only on user request; exclude deleted/hidden/image/blocked-user messages from the range since last read. Follow policy/WBS for limits, timeouts, and 202 async acceptance. Results are draft-retained for 7 days, visible only to requester, and shared with the team only after explicit sharing as a chat card.
PRD specifies self-hosted Ollama by default and requires vendor/training/non-transfer checks if using an external AI provider. Put model implementations behind server-side `LlmClient`. Do not send messages externally until message scope, retention, and processor are settled. Do not automatically create issues from summary tasks; require user review.
## 12. Subscriptions, Payments, and Hiring
**12.1 Subscriptions and Entitlements**

| Plan | Target/benefits | MVP status |
|---|---|---|
| Free | Collaboration/connectivity and basic social | Baseline |
| Pro | Individual analytics/profile-view alerts; larger photo/pinned-post/recruitment limits | S-1–S-3 payment flow Required; S-4/S-5/S-10 benefits Included |
| Flex | Team-size pricing, full-history search/image retention, AI summary/progress graph | Subscription flow Required; S-6–S-9 and C-5/T-7 Included |
| Scout | One recruitment ad, higher daily offer limit | H-5–H-9 Included in MVP; reconcile with demo criteria and WBS deferral rules |
Use PRD/policy as the source for exact prices, trial, limits, and cancellation grace. A server-side entitlement service evaluates user type, owner (account/team), validity, payment-failure grace, trial, and suspension state; do not trust subscription rows sent by the frontend. Separately apply the policy for existing posts/summaries/messages after benefit expiry.
**12.2 Payment Flow and Toss**
1. The server determines plan/owner/price/currency/order ID, creates the order, and records a pending payment.
2. The client payment widget displays order data but is not trusted for price or owner.
3. On payment success, Spring calls Toss approval and revalidates order, amount, and payment state.
4. Record approval/cancellation with idempotency and Toss payment keys; activate subscription entitlement once.
5. Make webhook/redirect retries idempotent. Reconcile provider state and provide operator recovery if DB persistence fails after approval.
6. Follow source policy for cancellation/refund/failure grace/expiry/Flex seat pricing. If billing-key storage/auto-renewal is unresolved, separate it from a one-time MVP payment proposal.
`[Confirmed]` README/PRD assume portfolio demo, Toss test mode, and no real payments. `[Unresolved]` Policy describes 7-day trial and monthly/yearly auto-renewal, while WBS risk mitigation suggests a one-time payment plus expiry date for the first demo, deferring billing keys/trial. Validate whether test mode can charge, and verify approval/webhook/cancel flow before deciding launch scope.
**12.3 Recruiters and Ads**
- Email-domain verification qualifies signup; it does not constitute corporate legal-entity verification or staff approval. Ad pre-review/company verification are excluded from MVP.
- Recruiter offers are allowed only when developer job status is `OPEN` or `OFFERS_ONLY` (ERD `JobSeekingStatus`). The first message appears in requests; consent opens a conversation. Do not automatically disclose contact information to recruiters; Policy validates Scout (H-5), one ad per recruiter, one job category, HTTPS/allowed domain, end date, dismiss/hide/report, and frequency. Target only logged-in developers who selected a matching interest category; do not show ads to guests, recruiters, or developers with no selected category.
- Keep ad URL out of feed responses; WBS click API records and returns it. Frontend owns external-navigation confirmation; `ad_daily_stats` contains daily aggregates only; do not persist individual viewers. Ad analytics UI is Phase 4 and excluded.
## 13. Files and Storage
The ERD defines `uploaded_files`; binary data is stored outside the database in Object Storage. Recommended image flow: issue upload authorization → upload directly → confirm completion.
- Spring verifies login/ownership and validates content type/size before issuing a restricted presigned URL. On completion, verify object existence, size, and owner; Apply MIME sniffing, allowed-format checks, malware handling, pixel limits, resize to a 2,048px long edge, EXIF location removal, and GIF first-frame policy.
- Separate access rules for public files and restricted team/direct-chat files using expiring/signed URLs or proxied downloads; Manage deletion/retention separately for post photos, avatars, chat images, and issue-body images. Track original and preview derivatives together.
- Object Storage provider/region/cost/DPA/backup lifecycle are unresolved. Decide whether the BFF proxies large byte streams after validating size and deployment limits.
## 14. Personal Data and Legal Policy
**14.1 Minimum Requirements from Source Documents** The privacy policy and terms are drafts. Effective date, responsible contact, vendors, some retention periods, and legal interpretations remain blank. The design below is implementation preparation, not a legal compliance conclusion.
- **Signup consent:** Record actor/time/document version for terms, personal-data collection, optional consent, age confirmation, and marketing channel consent in `user_agreements`. Refusal of optional consent must not block basic use; **Data minimization:** Collect GitHub identity/profile, developer-selected public profile data, activity data required for product functions, email/company data, and payment transaction metadata only for their stated purposes. Linker does not store card numbers.
- **Non-member GitHub organization data:** Settle installation scope, display purpose/notice, and deletion. Clean cached values when the GitHub source disappears; **Third-party provision:** Distinguish public-profile visibility to recruitment applicants from information users themselves share by message. MVP recruiter offers do not automatically provide email/contact details.
- **Processing/out-of-country transfer:** Confirm actual hosting/Vercel/GitHub/Expo-Google/Toss/email/analytics/error/file/AI providers before finalizing policy, DPAs, regions, and retention; **Rights/withdrawal:** Draft calls for 30-day grace then deletion/anonymization, immediate GitHub-token removal, and backup lifecycle. Legal review is needed for anonymizing authors in team chats while retaining other users' records, and retaining direct messages until both participants leave.
- **Report evidence:** Snapshot only the reported message and limited surrounding context (policy says 10 messages). Prevent operators from viewing unrelated full conversations; **AI:** Align notices and implementation on messages sent, processor, cross-border transfers, training use, 7-day result retention, and distinct retention for summaries shared as chat cards.
- **Audit logs:** Define admin actions, personal-data access actor/reason, retention/deletion, and export permissions.
**14.2 Backend Features Reflected in Draft Terms** The terms draft covers GitHub permission, user-content responsibility, prohibited conduct, reports/actions, subscriptions, and AI summaries. The backend should support GitHub scope/disconnection, owner edits/deletion, graduated sanctions/appeals, subscription cancellation/refund state, and on-demand summaries shared only by explicit user action. Legal validity of terms, e-commerce retention obligations, and liability clauses require legal review.
## 15. Errors and Transactions
**15.1 Error Contract**

| Situation | HTTP meaning | Example code/frontend behavior |
|---|---:|---|
| Missing/expired session | 401 | `LOGIN_REQUIRED`/`UNAUTHORIZED`; prompt login or reauthentication. |
| Role/team/ownership denied | 403 | `DEVELOPER_ONLY`, `TEAM_ROLE_REQUIRED`, `SUSPENDED`. |
| Deleted/hidden/private | Prefer evaluating 404 | `NOT_FOUND`; consider a uniform response to avoid revealing existence. |
| Validation/state-transition conflict | 400/409 | `VALIDATION_ERROR`, `STATE_CONFLICT`. |
| Limit/excess requests | 429 | `RATE_LIMITED`, `PLAN_LIMIT` with limit details. |
| GitHub/Toss/storage failure | 502/503 | `GITHUB_UNAVAILABLE`, `GITHUB_PERMISSION`, payment error; decide whether to retain user draft. |
| Async work accepted | 202 | Return a job ID; expose progress/failure through the WBS status route. |
Use the WBS fixed envelope `{code,message,detail}`. Align additional codes/HTTP mappings in Spring OpenAPI and frontend `ApiError`. Do not expose sensitive upstream bodies from BFF network errors.
**15.2 Transactions and Idempotency**

| Operation | Atomic DB section | External/asynchronous follow-up |
|---|---|---|
| Accept application | Application state, headcount, team member, team-chat member, notification creation | Send/retry GitHub org invite; track status. |
| Send message | Idempotent message persistence, room activity, read/notification state | STOMP broadcast/push retry. |
| Create issue | Consistent sync job and Linker cache/request result | Stepwise GitHub issue/Projects calls. |
| GitHub webhook | Persist/deduplicate delivery ID | Update event domain and emit PR system message. |
| Toss approval | Unique payment key/order; commit payment and subscription state together | Query/reconcile Toss and operator recovery after failure. |
| Upload completion | File state, owner, linked reference | Image conversion/EXIF removal/thumbnail/failure cleanup. |
| Operations action | Target state + admin action audit row | User notification/external delivery. Never delete audit event. |
Do not hold DB transactions open during external calls. Converge repeated operations through idempotency keys and unique constraints. Retry count/backoff/DLQ/manual recovery UI are `[Proposals]`, not confirmed until infrastructure is chosen.
## 16. Asynchronous Processing and Batches
Follow ERD Section 6 for batch work. Verify exact cron/time zone/deletion rules against the source before configuring jobs.

| Job | Responsibility |
|---|---|
| GitHub webhook consumer/reprocessing | Async sync after signature verification and event persistence; prevent duplicate/stale events. |
| Backfill for missed webhooks | Compare installation/repository/issue/PR cache with GitHub source within rate limits. |
| `issue_sync_jobs` retry | Track issue creation/Projects application steps and failure stage. |
| Progress-graph snapshots | `team_progress_snapshots`, documented daily 00:00 KST job and 1-year retention. Whether all teams are aggregated follows ERD. |
| Notification/push delivery | Separate in-app record from provider delivery; remove invalid push tokens. |
| Subscription/offer expiry and entitlement transitions | Apply payment-failure grace, trial/renewal, ad subscription expiry, 30-day offer request expiry, etc. |
| Content/account/file cleanup | Soft delete→physical deletion, withdrawal grace, backup purge, original/preview chat-image lifecycle. |
| Report/sanction expiry and suspension release | Apply policy transitions, permanently banned GitHub ID retention, preserve audit. |
| Daily ad aggregation | Aggregate anonymous Redis daily counters into `ad_daily_stats`; do not introduce per-viewer records. |
| AI-summary purge | Delete request result after 7 days; shared chat message follows chat retention. |
Batches must be idempotent and rerunnable. Do not confuse UTC DB storage with KST policy-date boundaries.
## 17. Test and Validation Strategy
This section provides a checklist for validating that the document connects the contracts; it does not claim implementation tests were run.
- **Requirements traceability:** MVP required/included/excluded features connected to PRD IDs, TODO pages, WBS APIs, and ERD tables; **API/authorization:** Role-specific 401/403, developer-only, team role, owner, recruiter state, admin OTP, optional-auth public responses and cache separation.
- **BFF security:** Cookie/Set-Cookie forwarding, CSRF, origin allowlist, header allowlist, SSRF prevention, file size/stream handling, common error envelope, authenticated-response cache control; **Authentication:** OAuth state/PKCE replay/tampering, disallowed `returnTo`, refresh concurrency, logout/withdrawal/suspension/cookie expiry.
- **Database races:** Duplicate applications/final-slot acceptance, active team member, message retries, webhook delivery, duplicate Toss callback, one ad per recruiter; **GitHub:** App installation revalidation, org/repository permission, webhook signature/out-of-order events, rate limit/retry, Projects date/Blocked spikes.
- **Realtime:** Reject unauthorized room subscription, membership revocation, reconnect gap recovery, message order/read cursor, BFF ingress `/ws` upgrade; **Subscriptions/ads:** Free/Pro/Flex/Scout entitlement, plan/user-type mismatch, trial/cancel/failure/refund, targeting/URL/daily frequency/hide/report.
- **Privacy:** Optional consent, withdrawal recovery/purge, token deletion, backup/file lifecycle, report-evidence scope, admin audit, AI input/deletion; **Operational flow:** TODO MVP demo checklist across web, iOS Safari, Android Chrome, and Expo WebView authentication.
Separate sandbox/provider-account verification from unit/integration automation. Do not require tests for features excluded from MVP.
## 18. Deployment and Operations
Confirmed source assumptions are a portfolio demo, no app-store release, Toss test mode, Spring/PostgreSQL/Redis, and Expo WebView development build. Backend host, service domain, and Seoul region are pending TODO/WBS decisions.
Deployment decisions to verify:
- Internal Next.js-to-Spring path, public ingress routes, TLS, and GitHub/Toss webhook URLs; `/ws` WebSocket upgrade timeout, sticky sessions/Redis broker needs, and connection draining.
- PostgreSQL/Redis backups and restore tests, secret management, migration/rollback, schema rollout order; Object Storage, email, Expo/FCM, AI provider region/DPA alignment with the privacy notice.
- Request/correlation IDs, personal-data/token redaction, error monitoring (Sentry is a PRD monitoring candidate), costs, and external API rate-limit dashboards; UTC server time vs KST policy dates, batch deduplication, graceful shutdown, webhook redelivery recovery.
- Never expose Spring origin/secrets to browsers; separate staging/test Toss keys from production keys.
Do not state example vendors or versions as confirmed. Vendors named as candidates in the privacy draft remain `[Unresolved]` until verified as actual processors.
## 19. Implementation Sequence
Follow MVP Definition and TODO/WBS page dependencies. WBS assumptions of five people/two weeks are planning assumptions, not commitments.

| Order | Domain group | Prerequisite/output | Feature traceability |
|---:|---|---|---|
| 0 | Shared foundation/BFF decision/auth/permissions/files/reports-blocks/webhook ingress/DB-Redis | GitHub OAuth/App, Projects, STOMP, Toss, BFF/cookie boundary spikes | Page 00 |
| 1 | Account/consent/profile | Session, agreement version, tech tags, job status, public SEO reads | A-1–A-4, A-9, H-4; 01–06 |
| 2 | Team creation/GitHub links/invites | Revalidate installation permissions; link team/chat/members | T-1–T-3; 07–10 |
| 3 | Issues/schedule/board | `issue_sync_jobs`, cache consistency, Projects spike | I-1–I-5, T-7 included; 11–15 |
| 4 | Chat/PR/notifications | STOMP auth/subscribe ACL/reconnect, message idempotency | C-1–C-3, N-1; 16–18 |
| 5 | Recruitment/application/acceptance | Team/chat join transaction, headcount race, notification | R-1–R-4; 19–21 |
| 6 | Posts/feed/direct chat | Upload, block/follow, public view, share card | P-1–P-5, P-7, C-4/C-7, T-4/A-5; 17, 22–24 |
| 7 | Reports/operations/audit | O-4 evidence limits, decide admin OTP, audit | O-1–O-5; 25–27 |
| 8 | Payments/subscriptions/benefits | Toss approval/refund, entitlement, settle payment mode | S-1–S-10; 28–30 |
| 9 | Recruiters/Scout ads | Company email, offer requests, interest categories/ads, moderation | H-1, H-3, H-5, H-7–H-9; 31–33 and 04/05/17/24 |
| 10 | Integration regression/release policy | MVP demo, privacy/legal/hosting decisions | All MVP launch criteria |
Settle BFF calls and STOMP/cookie behavior before page implementation. If BFF exposes public paths different from WBS, record the contract in OpenAPI/Orval. Do not let Included features block the P0 core flow.
## 20. Unresolved Items and Document Conflicts

| Item | Source documents | Confirmed so far | Conflict/unresolved | Backend impact | Decision needed |
|---|---|---|---|---|---|
| MVP launch scope | PRD, MVP, TODO, WBS, ERD | MVP required/included/excluded, PRD P0/P1, and WBS schedule labels are distinct | Launch criteria require Scout ads and some included demos, while schedule risk response defers some included items | Changes launch gates for data/APIs/screens | Decide release gate per feature, especially H-5/H-7–9, C-5, T-7, share cards, S-4–10; sync docs |
| BFF adoption | Frontend 10, WBS 09, this blueprint | Frontend `api-fetch.ts` directly calls Spring via `API_BASE_URL` on server/browser and expects api-domain cookies/CORS | BFF route/Orval mutator is absent from frontend blueprint | Changes auth transfer, cache, errors, deployment/CORS/OpenAPI path | Frontend follow-up: API origin, route handler, server adapter, Orval spec/mutator, errors, cookies/CORS |
| Cookies/sessions | PRD, policy, ERD, WBS, frontend | httpOnly cookie, 30-day extension, refresh session; FE proposes parent domain + JWT claims | JWT/opaque, access/refresh, rotation/reuse, host-only/shared domain, CSRF, logout route unresolved | Affects auth library/Spring Security/BFF/WebView/STOMP | Approve same-origin/domain and token lifecycle; fix refresh/logout OpenAPI contract |
| Realtime path inventory (resolved) | WBS 16–18 | 5 shared paths: `/ws`, message SEND, room SUBSCRIBE, notification SUBSCRIBE, chat-list SUBSCRIBE | The page-16 chat-list subscription was previously omitted from the shared table | Cover connection auth and all destination ACLs/recovery | Maintain the shared inventory in WBS 17; no new path |
| REST count/controllers (resolved) | WBS | 40 controllers (33 page + 7 shared); detailed REST rows and controller totals both equal 204 | Earlier 192-endpoint count was stale | Keep OpenAPI and estimates aligned | Update detailed rows, controller totals, and overview together when APIs change |
| GitHub Projects source fields | PRD, policy, ERD, WBS, TODO | GitHub Projects board stores dates/status; Linker DB is cache | Start/Due date and Blocked representation, free-org permissions/issue-fields alternative, app removal/reinstall state | Issue schema, sync jobs, recovery | Decide from D1–D2 spike with test accounts/results |
| Toss recurring payment | PRD, policy, MVP, WBS, ERD | Test mode; S-1–3 subscription is required; `subscriptions`/`payments` are 🟢 | Policy says trial/monthly/yearly renewal; WBS proposes one-time payment/expiry first and defers billing key/trial | Payment method, scheduler, refund, entitlement scope | Validate approval/cancel with test key, then choose first-release mode |
| Plan prices/policies | PRD, policy, ERD, terms | Pro/Flex/Scout prices/benefits and Flex seats/Scout limit are listed | Most amounts/limits are tentative; Flex seat count date, trial, and remaining time during suspension unresolved | Price calculation, recurring billing, entitlement, ad stop | Finalize price/calculation/refund in policy/terms |
| Chat retention/withdrawal | Policy, privacy notice, terms, ERD | Team chat author is retained as deleted user; DM deleted after both leave | Conflict between post-withdrawal deletion and other users' records/report evidence; privacy wording is draft | Anonymization/FK/file purge changes | Legal review and data-specific deletion/anonymization windows |
| Legal retention/processors | Privacy notice, terms, README | Hosting/email/analytics/error/file/AI placeholders; Toss/Vercel candidates | Actual vendor/country/period, notice for non-member GitHub data, international/AI transfer basis, statutory period | Schema purge, log retention, DPA, region | Confirm actual vendors/regions and complete legal review/docs |
| Reports/permanent bans | Policy, ERD, privacy | Snapshot scope 10 messages, sanction history 1-year draft, retain banned GitHub ID | Permanent ID retention `[N years]`, temporary measure/legal process | Separate personal-data retention, re-signup block, access audit | Legal/operations lead decides retention and appeal/recovery |
| Ad aggregation/privacy | MVP, policy, ERD, privacy | Daily aggregation only; no per-user ad impressions in DB | Accuracy/recovery if Redis counters are lost; refund after ad reports | Ad frequency/stats/privacy logging | Decide acceptable aggregation loss/recovery and enforcement/refund |
| File storage | TODO, ERD, policy, privacy | Presigned/Object Storage, EXIF removal/size/format rules | Provider/region/public access/deletion/backup retention unresolved | BFF upload/download, URL security, purge | Approve vendor/DPA/region and direct presigned upload |
| Deployment/operations | README, TODO, WBS, privacy | Portfolio dev build, Spring/Postgres/Redis, test payment | Backend host/domain/region, monitoring/backup/secrets unresolved | Webhook/STOMP reachability, CORS/cookies/BFF routing | Decide using staging and actual data flows |
| Completion/statistics formulas | PRD, policy, ERD, TODO | Completed-project count/issue completion rate, profile visits/post views | Denominator/cancel/restart, profile-view boundaries/referrer classification | Calculation/batch/display consistency | Define formulas and reporting periods per feature |
| Terms/AI | Terms, privacy, PRD, policy | On-demand chat summary; user chooses to share with team | Ollama capacity, external processor/training, final notice language | Message transfer scope/international transfer/cost | Select model/hosting and legal wording |
## 21. Final Validation Checklist
- Traceability: keep PRD priority, MVP required/included/excluded scope, and WBS work labels distinct; link API, page, controller, service, and ERD. ERD: 56 required + 13 included = 69 tables; Verify the WBS baseline: 40 controllers, 204 REST endpoints in both detailed rows and controller totals, and 5 shared realtime paths (1 connection endpoint + 4 STOMP destinations).
- Verify BFF, cookies/CSRF, OAuth, direct webhook/Toss ingress, STOMP ACL/reconnect, file access, idempotency, privacy deletion/audit, vendors, and legal decisions.
## Appendix A. Source Document Map
01 Service Plan: purpose, actors, flows; 02 PRD: feature IDs and priority; 03 MVP: release scope; 04 Policies: roles, limits, states; 05–06 Legal: terms and privacy; 07 TODO: screens and dependencies; 08 ERD: data model; 09 WBS: APIs and access; 10 Frontend Blueprint: Next.js, Expo, Orval; 11 README: repository and runtime assumptions.