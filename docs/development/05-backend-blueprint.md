# Linker Backend Blueprint — Four Access Groups, No Separate Auth Package


> 2026-11-04 · Four access groups, 29 HTTP controllers. Previous official draft: [`.local-notes/backend/old/05-backend-blueprint_old.md`](../../.local-notes/backend/old/05-backend-blueprint_old.md).
> Korean draft (same rules): [`.local-notes/backend/fix/BACKEND_BLUEPRINT.ko.md`](../../.local-notes/backend/fix/BACKEND_BLUEPRINT.ko.md). Java code is not migrated yet.


## 1. Sources and scope

| Source | Owns |
| --- | --- |
| [Local folder proposal](../../.local-notes/backend/fix/BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md) | Target controller placement and all 205 API assignments |
| [Local WBS PDF](<../../.local-notes/backend/fix/03-linker-wbs-schedule - 03-linker-wbs-schedule.csv.pdf>) | S01–S18 work, implementers, dates, collaboration and schedule flags |
| [Official WBS](02-wbs.md) | API behavior, permissions, pages and work contracts |
| [Policy](../planning/04-policy.md) | Numbers, roles, states, exceptions and UI copy |
| [Existing ERD](01-erd.md) | Tables, columns and relationships |
| [MVP](../planning/03-mvp-definition.md) | Required/Included scope and launch conditions |

**Target:** 18 business systems, 29 HTTP controller classes, 205 REST endpoints, 5 realtime paths, 69 tables (56 required + 13 included), and 33 pages plus foundation 00. Controller classes and business systems are different counts. These are design totals, not implementation progress.

AGENTS matches this 29-controller / four access-group layout. The WBS narrative may still say “18 controllers” in places; treat that as the 18 business systems until WBS wording is updated.


## 2. Architecture and layer boundaries

One Spring Boot application serves the mobile-first Next.js web and Expo WebView. Spring owns authentication, authorization, state, limits, transactions and entitlements. GitHub is authoritative for orgs/repos/issues/PRs; Linker reads its synchronized cache and owns chat, applications, posts, payments and moderation.

Keep `com.linker.backend`, Java 21 and the existing Gradle project. The inspected build uses Spring Boot 4.1.2; this document does not request an upgrade. No microservice split or new schema is implied.

| Layer | Responsibility | Avoid |
| --- | --- | --- |
| controller | HTTP validation, access declarations, service calls, DTO responses | Direct repository queries, business-rule copies, entity responses |
| service | Shared capabilities, use cases, transaction coordination | Servlet coupling, per-role copies of the same rule |
| repository | Persistence and query projections | Pricing or access-policy decisions |
| entity | ERD state, relationships and state changes | Acting as API JSON contracts |
| dto | Actual request/response contracts | JPA mappings, duplicate types only because roles differ |
| integration | External-system adapters | Treating unverified provider output as business success |
| async | Queue consumption, post-commit delivery, scheduled entry points | Duplicated rules outside services |
| global | Config, security, errors and JPA infrastructure | Unrelated feature helpers |

Use Controller → Service → Repository. Keep `global.error`, shared `BaseTimeEntity`, and business-based repositories/entities. Do not create mixed-layer `domain`, page-number packages, `service.support`, `global.exception`, or `global.response`.


## 3. Package structure

```text
com.linker.backend/
├── BackendApplication.java
├── controller/
│   ├── public_/
│   ├── user/
│   ├── recruiter/
│   ├── admin/
│   └── GithubWebhookController.java
├── service/
│   ├── auth/, account/, profile/, catalog/, legal/
│   ├── github/, team/, issue/, chat/, notification/
│   └── recruit/, post/, feed/, moderation/, subscription/, recruiter/, file/, sitemap/
├── repository/{business}/
├── entity/{business}/
├── dto/{business}/request|response/
├── integration/github|payment|mail|push|storage|ai/
├── async/webhook|notification|schedule/
└── global/config|security|error|jpa/
```


- `public` is the access label; `public_` is the Java package because `public` is reserved. Keep the HTTP prefix `/api/v1/public`.
- `user` means **authenticated accounts**, not developers only. Notifications, uploads, chat and subscription APIs may serve developers and recruiters. Apply `@DeveloperOnly` to developer-only methods, plus team/resource checks. Never make the whole user package developer-only.
- `recruiter` holds recruiter-only actions; `admin` holds operator actions. An operator is a developer with `admins` permissions and follows normal developer rules outside admin actions.
- Do not add `controller.member`, a member account role or `/member` URLs. Do not add `controller.auth`; login, refresh, password and OTP endpoints remain in their access groups. Keep shared authentication logic in `service.auth`.
- `GithubWebhookController` is a root-level controller exception, not a fifth human access group. Verify GitHub signatures and delivery IDs on the existing webhook URL.
- Repositories/entities follow existing business data ownership, not caller roles. DTOs use business request/response packages; a response-only capability may use a direct business DTO package. Resources remain `application.yml`, `db/migration/`, and legal resources when implemented; tests mirror layers/business packages.


## 4. Controller inventory and ownership

The proposal owns the complete 205-endpoint assignment. This inventory summarizes it without copying all contracts. Class names use role prefixes to avoid default Spring bean-name collisions. Do not generate empty controllers in bulk.

| Package | Controller | REST | Implementers |
| --- | --- | ---: | --- |
| controller.public_ | `PublicAccountController` | 2 | A |
| controller.public_ | `PublicAuthController` | 10 | A |
| controller.public_ | `PublicCatalogController` | 2 | A |
| controller.public_ | `PublicLegalController` | 2 | A |
| controller.public_ | `PublicPostController` | 6 | A, E |
| controller.public_ | `PublicRecruitmentController` | 2 | E |
| controller.public_ | `PublicSitemapController` | 1 | B |
| controller.public_ | `PublicTeamController` | 2 | A, B |
| controller.user | `UserAccountController` | 15 | A |
| controller.user | `UserAdController` | 4 | E |
| controller.user | `UserChatController` | 22 | C, D |
| controller.user | `UserGithubController` | 4 | B |
| controller.user | `UserIssueController` | 22 | C, D |
| controller.user | `UserModerationController` | 5 | D, E |
| controller.user | `UserNotificationController` | 7 | A, D |
| controller.user | `UserPostController` | 15 | A, E |
| controller.user | `UserRecruitmentController` | 15 | E |
| controller.user | `UserSessionController` | 2 | A |
| controller.user | `UserStatsController` | 3 | B |
| controller.user | `UserSubscriptionController` | 10 | D |
| controller.user | `UserTeamController` | 27 | B |
| controller.user | `UserUploadController` | 2 | E |
| controller.recruiter | `RecruiterAccountController` | 1 | A |
| controller.recruiter | `RecruiterAdController` | 3 | A |
| controller.recruiter | `RecruiterAuthController` | 1 | A |
| controller.recruiter | `RecruiterChatController` | 5 | A, D |
| controller.admin | `AdminController` | 13 | A, B |
| controller.admin | `AdminSubscriptionController` | 1 | B |
| controller | `GithubWebhookController` | 1 | B |
| Total | 29 controllers | 205 | |


REST by group: **public_ 27 / user 153 / recruiter 10 / admin 14 / webhook 1**. Keep A–E page/endpoint implementers and S01–S18 business maintainers from the WBS. Changing a Java package does not transfer another person's work. Shared controller changes need the relevant business maintainer's review.


## 5. HTTP, authentication and authorization

Keep each API's method, path, query, permission, DTO, status, error code, page tag and operationId. Java packages do not define URLs. `/api/v1/user` still includes shared authenticated APIs; developer-only conditions remain method-specific. Optional-auth public reads may return viewer-specific fields and must not leak them through shared caches. Personalized plans use `Cache-Control: private, no-store` and account-scoped frontend queries.

| Action | Controller | Required check |
| --- | --- | --- |
| GitHub/company-email sign-up, login and reset | PublicAuthController | State, verification/reset tokens, allowed return URL, failure limits |
| Refresh | PublicAuthController | Valid session/refresh eligibility despite public URL |
| Current session and logout | UserSessionController | Authenticated account and own session |
| Change recruiter password | RecruiterAuthController | Authenticated recruiter, own account |
| Operator OTP | AdminController | Logged-in registered operator candidate; permit the pre-OTP verification step |
| Shared notifications/uploads/chat | User controllers | Login plus owner, participant and account-state checks |
| Teams/issues/recruit writing | User controllers | Developer, team/resource and GitHub permissions |
| Member payments / operator refunds | UserSubscription / AdminSubscription | Same payment service; distinct payer/target and admin checks |

Apply authorization in `global.security` and business services: account state, account type, team role, resource owner/participant, GitHub permission and entitlement as required. Package names do not grant access. Operator privileges never bypass ordinary team/chat membership.

JWT is the documented target in AGENTS; the inspected implementation is a random cookie token with a DB SHA-256 hash, not JWT. Keep authentication secrets in httpOnly cookies, never JavaScript or the native bridge. JWT migration, rotation and cookie deployment settings are separate work. Protect cookie writes with the agreed Origin/CSRF mechanism; frontend route guards are not server authorization.

Public profiles depend on both the profile owner's account type and the viewer's access. Use PublicAccount for the base profile, PublicPost/PublicTeam for its lists, UserAccount for common edit values and developer changes, RecruiterAccount for company changes. Admin-only data uses separate audited admin APIs.

Responses keep the existing unwrapped success body, cursor `{items, nextCursor}`, create/async statuses and `global.error` shape `{code, message, detail}`. Do not expose entities. Preserve original per-endpoint `p00`/`pNN` OpenAPI tags at method level when classes split; do not apply every tag to an entire class.


## 6. Realtime and shared business rules

| Kind | Path |
| --- | --- |
| WebSocket | `/ws` |
| STOMP SEND | `/app/chat-rooms/{roomId}/messages` |
| SUBSCRIBE | `/topic/chat-rooms/{roomId}` |
| SUBSCRIBE | `/user/queue/chat-rooms` |
| SUBSCRIBE | `/user/queue/notifications` |


Place the single common SEND entry on UserChatController; recruiter offers reuse shared chat services. Authenticate CONNECT, authorize SEND/SUBSCRIBE and protect personal queues. Persist messages, commit, then publish; reconnect catches up through existing REST. Do not add destinations or a ticket API. These five paths are separate from the 205 REST endpoints.

| Business | Shared rule |
| --- | --- |
| Recruitment acceptance | ApplicationService coordinates application, headcount, team membership, chat membership and in-app notification; GitHub org invitation remains separate |
| GitHub/issues | User and installation tokens are distinct; verify signatures, dedup delivery IDs, refresh caches and reconcile missed events |
| Chat | Dedupe by sender/client message ID; same-room read pointers; consistent block-period/leave/hidden rules; team-chat exception follows Policy |
| Notifications | NotificationService.create is the shared producer entry; TEAM_INVITE uses /invite/{code}; in-app, read and async push states are distinct |
| Payments | Server verifies price/account/target and PG results; payment plus entitlement is consistent; use the same service for user/admin operations |
| Moderation | Limited report snapshots, preserved block periods, separate appeal reviewer and audited actions; no arbitrary operator chat access |
| Files | Validate owner/type/MIME/size, complete after inspection/processing, distinguish public/chat access |
| AI/ads/stats | Preserve eligibility, limits, retention and privacy; model/provider choice and job-ad launch scope are not decided by this structure |

Do not hold a database transaction open across a provider call. Persist operation state, verify external outcomes and use idempotency/reconciliation. PostgreSQL is durable truth; Redis is queue/cache/rate-limit/counter infrastructure. New outbox tables or usage columns require an explicit ERD/migration change, not this folder proposal.

Keep the 69-table ERD, existing Flyway history and mapped columns. Do not reset the database or rewrite an applied V1. Jobs reuse services and must tolerate reruns: webhook/sync retries, notification delivery, progress snapshots, subscription/request/ad expiry, content/account/sanction cleanup, ad aggregation and AI-result expiry.


## 7. Runtime, schedule and current implementation

Preserve the existing Compose/Nginx/main-deployment setup. The current proxy routes `/api/v1/` to Spring and `/ws` with upgrade headers; `/api/bff/` is reserved, not proof of a finished BFF. Follow [Docker](../operations/02-docker.md) and [automatic deployment](../operations/04-automatic-deployment.md). Do not change deployment or select providers as part of folder migration.

The PDF schedules work for **2026-11-04 through 2026-11-07**. Keep dates and flags in the PDF rather than independently maintaining them here. “Included/follow-up” and “schedule risk” do not mean deleted or completed. Ad management lacks the Included label in the PDF while the official WBS has it; confirm launch scope instead of silently promoting it.

Collaboration stays: PR B↔D, invite notification B↔D, issue card D↔C, AI C↔D, recruitment acceptance E↔B·D, and ads A↔E·D. Page owners remain responsible for their UI/server work; the system maintainer reviews shared business contracts.

Existing controllers have been moved to `controller.public_` / `controller.user` / root `GithubWebhookController` (no empty recruiter/admin shells yet). Session cookies use random tokens; STOMP authentication/access scaffolding exists, but `UserChatController` currently rejects sending as not ready rather than persisting/broadcasting. Notification/rate-limit/payment adapters are foundations, not evidence that all planned pages are complete.


## 8. Migration and unresolved decisions

1. Adopt this 29-controller layout in the official WBS, blueprint and AGENTS together; retain the 18 business systems and original API/implementer assignments.
2. Move existing classes first: Catalog/Sitemap → public_; session lookup → UserSession and refresh → PublicAuth; Upload/Moderation → User classes; GitHub ingress → root GithubWebhook; common SEND → UserChat. Add missing methods only with their planned feature.
3. Preserve routes, permissions, DTOs, tags, operation IDs, entity mappings and active work. Never register an old and new controller on the same route. Keep services/repositories/entities shared and reconnect imports, DI and tests.
4. Verify the existing build and relevant API/security/transaction/STOMP behavior during implementation. This document records a design, not a claim that migration tests have run.

Still open: JWT migration and cookie/rotation details; actual BFF adoption; payment trial/renewal scope; AI/mail/storage providers and legal retention; Included launch gates. No secret values, payment card data, passwords, tokens or message bodies belong in documentation/logs. Apply agreed consent and retention rules; legal drafts are not newly resolved here.

**Deliverable:** this blueprint file (English) plus the controller package migration of existing classes. Korean draft and source proposal remain under `.local-notes/backend/fix/`. SQL, database and deployment are unchanged by this folder move.


### Source fingerprints

- `BACKEND_FOLDER_STRUCTURE_FOUR_ROLES.md` — SHA-256 `a89c97c426bc`

- `03-linker-wbs-schedule - 03-linker-wbs-schedule.csv.pdf` — SHA-256 `1d1c17b54d10`
