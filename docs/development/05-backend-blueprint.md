# Linker Backend Blueprint

> 2026-11-04 · Official backend architecture. Start from [AGENTS.md](../../AGENTS.md), then §3–§4 here.

## 1. Sources and scope

| Source | Owns |
| --- | --- |
| This blueprint §3–§4 | Package placement, controller/service inventory, mandatory role-service rules |
| [WBS](02-wbs.md) | API behavior, permissions, pages, work contracts, S01–S18 maintainers, A–E implementers |
| [Policy](../planning/04-policy.md) | Numbers, roles, states, exceptions, UI copy |
| [ERD](01-erd.md) | Tables, columns, relationships |
| [MVP](../planning/03-mvp-definition.md) | Required/Included scope, launch conditions |

**Design totals:** 18 business systems, 29 HTTP controllers + 29 planned paired entry services, 205 REST endpoints, 5 realtime paths, 69 tables (56 required + 13 included), 33 pages plus foundation 00. Controller count ≠ business-system count. These are design totals, not implementation progress; internal role services may exist beyond the controller pairs.

**Forbidden:** empty controllers or empty paired entry services "for structure" (for example all 29 `*Service` shells). Add a paired service with real endpoint work; an internal stage-00 role service may be added with its real use case and no controller.


## 2. Architecture and layer boundaries

One Spring Boot application serves the mobile-first Next.js web and Expo WebView. Spring owns authentication, authorization, state, limits, transactions and entitlements. GitHub is authoritative for orgs/repos/issues/PRs; Linker reads its synchronized cache and owns chat, applications, posts, payments and moderation. Keep `com.linker.backend`, Java 21 and the existing Gradle project (Spring Boot 4.1.2; no upgrade requested). No microservice split or new schema.

| Layer | Responsibility | Avoid |
| --- | --- | --- |
| controller | HTTP validation, access declarations, call to the paired service, DTO responses | Repository queries, business-rule copies, entity responses |
| service | Access-group-specific use cases | Servlet coupling; another role's service; neutral shared business service |
| repository | Persistence and query projections | Pricing or access-policy decisions |
| entity | ERD state, relationships, state changes | Acting as API JSON contracts |
| dto | Request/response contracts and the entity-to-response mappers shared by access groups (`dto/{business}/mapper/`) | JPA mappings; duplicate types only because roles differ |
| integration | External adapters **and** the GitHub webhook HTTP entry | Treating unverified provider output as success |
| async | Queue consumption, post-commit delivery, scheduled entry points | Rules duplicated outside services |
| global | Config, security, errors | Unrelated feature helpers |

Flow: Controller → (paired) Service → Repository. Keep `global.error`. Do not create a mixed-layer `domain`, page-number packages, `service.support`, `global.exception` or `global.response`.


## 3. Package structure

```text
com.linker.backend/
├── BackendApplication.java
├── controller/
│   ├── AuthController.java       # no role prefix on any class
│   ├── AccountController.java
│   ├── …                         # other public API controllers
│   ├── user/                     # bean names userXxxController
│   ├── recruiter/                # bean names recruiterXxxController
│   └── admin/                    # bean names adminXxxController
├── service/
│   ├── AuthService.java
│   ├── AccountService.java
│   ├── …                         # paired public entry services
│   ├── user/
│   ├── recruiter/
│   └── admin/
├── integration/
│   ├── github/                   # GithubWebhookController/Service + GitHub adapters
│   └── payment|mail|push|storage|ai/
├── repository/{business}/
├── entity/{business}/            # @Entity only; enums/constants/@Embeddable/composite keys in type/
├── dto/{business}/request|response|mapper/
├── async/webhook|notification|schedule/
└── global/config|security|error/
```

**Naming and placement**
- `public` is an HTTP access label only. Never create a Java package `public` or `public_`; public classes sit at the `controller` / `service` roots. The HTTP prefix stays `/api/v1/public`.
- Controllers and services carry no role prefix. The folder gives the role (`user/TeamService`, `admin/NotificationService`); root classes are the public group (`AuthController`, `AuthService`). Names repeat across folders, so every class in `user/`, `recruiter/`, `admin/` sets an explicit bean name that starts with the folder (`@Service("userTeamService")`, `@RestController("adminModerationController")`). Root classes keep the default bean name. When one file needs two same-name classes (for example `user.ModerationService` calling `admin.NotificationService`), write the fully qualified name for the other one.
- `user` means authenticated accounts, not developers only. Notifications, uploads, chat and subscription serve developers and recruiters; apply `@DeveloperOnly` and team/resource checks per method.
- `recruiter` holds recruiter-only actions; `admin` holds operator actions. An operator is a developer with `admins` permissions and follows normal developer rules outside admin APIs.
- Do not add `controller.member`, `controller.auth`, a member role or `/member` URLs. Login, refresh, password and OTP stay on their access-group controllers, with services named by the same rule.
- Repositories and entities are owned by business, not role. DTOs follow business request/response packages.
- `admin/ModerationController` handles operator OTP verification, report cases and appeals. A later split (for example an OTP controller) is out of scope here.

**API version `/api/v1`**
- Added once in `WebConfig`: `PathMatchConfigurer.addPathPrefix("/api/v1", HandlerTypePredicate.forBasePackage("com.linker.backend.controller"))`. Controller `@RequestMapping` omits `/api/v1`; the version is not a package.
- The webhook is outside this prefix: `GithubWebhookController` keeps its own explicit `@RequestMapping("/api/v1")` and its GitHub-registered URL.
- Collect any `/api/v1` literal in security filters into one constant.

**GitHub webhook**
- Lives under `integration.github` (not a fifth access group, not `controller` root). It accepts `POST /api/v1/webhook/github`, verifies signatures and delivery IDs, then hands off to async/business processing (§7).

**Entity**
- `entity/{business}/` holds only `@Entity` classes; the count matches the tables. Enums, constant holders, `@Embeddable` and composite-key classes go in `entity/{business}/type/`.
- No `BaseTimeEntity` and no `@EnableJpaAuditing`: each entity declares `createdAt`/`updatedAt` with Hibernate `@CreationTimestamp` / `@UpdateTimestamp`.

**Repository**
- JPA query methods and JPQL `@Query` first.
- `EntityManager` or dynamic queries: `XxxRepositoryCustom` (interface) + `XxxRepositoryImpl`. No `@Repository` on the Impl; no empty Custom. Queries over several entities go in the central entity's Custom.
- PostgreSQL features JPQL cannot express (`ON CONFLICT`, `pg_advisory` locks, `RETURNING`, `LATERAL`) use native queries with a comment giving the reason. `FOR UPDATE` uses `@Lock(PESSIMISTIC_WRITE)`.
- No new `JdbcTemplate`. QueryDSL is added only together with its dependency, when needed.
- Persistence classes are named `XxxRepository`, not `XxxQuery`, `XxxLock` or `XxxInserter`.


## 4. Controller ↔ service 1:1

Each HTTP controller calls its same-group paired entry service. Services with overlapping capabilities still use role-specific classes (`user.XService`, `recruiter.XService`, `admin.XService`); never route through a neutral `XService` or another role's service.

```text
user.SubscriptionController  → user.SubscriptionService  → PaymentGateway
admin.SubscriptionController → admin.SubscriptionService → PaymentGateway
```

- The generation rule is in [AGENTS.md](../../AGENTS.md#mandatory-backend-service-rule).
- May be shared: DTOs/commands, entities, repositories, policy constants, technical adapters. Not shared: business implementations.
- Add role services only with real work, never as placeholders for all planned controllers.
- Keep access checks and transactions explicit. When a rule repeats across roles, cover every implementation with the same policy cases so they cannot diverge.

### 4.1 Notification creation (stage-00 internal use case)

No notification controller or REST API is needed. Implemented producers: `service.user.NotificationService`, `service.recruiter.NotificationService`, `service.admin.NotificationService`.

- Each exposes `create(dto.notification.request.CreateNotificationCommand)`, validates recipient and optional actor, computes quiet hours from `PlanLimits`, and saves through `NotificationRepository` in the caller's transaction (rollback removes the row). `create` sends no push and publishes no STOMP; list, read, badge, push and the morning flush of `deliver_after` belong to page 18.
- The prefix names the producing use case, not the recipient's account type: a logged-in user flow (team invite) calls `user.NotificationService`, a recruiter flow `recruiter.NotificationService`, an operator flow `admin.NotificationService`. They do not delegate to each other, except the report auto-hide case in §4.2. There is no `PublicNotificationService`.
- Callers check their own permission and, for `MARKETING`, marketing consent before building the command. `create` does not filter senders the recipient blocked; that stays at the call site.
- `CreateNotificationCommand` requires `recipientUserId` and `notificationType`; optional: `actorUserId`, `targetType`, `targetId`, `linkPath`, `payloadJson`, `groupKey`. Blank `notificationType` throws `IllegalArgumentException`; blank optional strings are stored as null.
- `NotificationTypes` holds known strings (`CHAT`, `ISSUE_ASSIGNED`, `DUE_SOON`, `APPLICATION_RECEIVED`, `APPLICATION_ACCEPTED`, `APPLICATION_REJECTED`, `COMMENT`, `FOLLOW`, `MESSAGE_REQUEST`, `TEAM_INVITE`, `REPORT_AUTO_HIDDEN`, `MARKETING`). They are not a DB enum; producers may pass other strings.
- A missing or deleted recipient, or a present but missing or deleted actor, throws `404 NOT_FOUND` with `사용자를 찾을 수 없어요`. Deleted means `UserStatus.DELETED` or `deletedAt` set.
- Quiet hours (KST): `CHAT` stores `deliver_after` null; `MARKETING` waits 21:00–08:00; every other type 22:00–08:00; outside those windows null.

```java
userNotifications.create(new CreateNotificationCommand(
        recipientUserId, NotificationTypes.TEAM_INVITE, actorUserId,
        null, null, "/invite/" + code, null, null));
```

### 4.2 Report auto-hide notification (frozen contract)

- **Exception:** E's `user.ModerationService` calls `admin.NotificationService.create(CreateNotificationCommand)` once per active operator in the auto-hide transaction. This system-generated operator alert is the only cross-role service call allowed; it does not move Moderation logic into the notification service.
- **Recipients:** each active operator backed by `admins` and an active, non-deleted account. No notification to the reported user or reporters; the reported user sees only the existing 「검토 중」 UI.
- **Trigger:** the first transition of `auto_hidden_at` from null to a timestamp at `PlanLimits.REPORT_AUTO_HIDE_REPORTERS` distinct eligible reporters (currently 5). Not on every report or on later reports against an already hidden case. E owns the atomic transition and concurrency guard.
- **Command:** `recipientUserId = operator.userId`, `actorUserId = null`, `targetType = null`, `targetId = null`, `linkPath = "/admin/reports"`, `payloadJson = null`, `groupKey = "report-auto-hidden:" + caseId` (`report_cases.id`). `groupKey` is a grouping hint, not an idempotency guarantee; E resolves recipients and prevents duplicate production.
- The type is `NotificationTypes.REPORT_AUTO_HIDDEN`. Creation adds no REST, migration, push or STOMP delivery, and the 22:00–08:00 quiet hours still apply.
- Out of scope: chat ±10 report snapshots, reporter outcome notifications, sanctions notifications.

### 4.3 Inventory

| Placement | Controllers / entry services | REST |
| --- | ---: | ---: |
| controller / service roots (no prefix) | 8 / 8 | 27 |
| controller.user / service.user | 14 / 14 | 153 |
| controller.recruiter / service.recruiter | 4 / 4 | 10 |
| controller.admin / service.admin | 2 / 2 | 14 |
| integration.github (webhook) | 1 / 1 | 1 |
| **Total** | **29 / 29** | **205** |

The per-endpoint assignment (owning system, method, path, permission) is in WBS §4. Changing a Java package does not transfer ownership: A–E implementers and S01–S18 maintainers stay as in the WBS.


## 5. HTTP, authentication and authorization

Keep each API's method, path, query, permission, DTO, status, error code, page tag and operationId. Java packages do not define URLs. `/api/v1/user` hosts shared authenticated APIs; developer-only rules stay method-specific.

| Action | Controller | Required check |
| --- | --- | --- |
| GitHub/company-email sign-up, login, reset | AuthController | State, verification/reset tokens, allowed return URL, failure limits |
| Refresh | AuthController | Valid session/refresh eligibility despite public URL |
| Current session and logout | user.SessionController | Authenticated account, own session |
| Change recruiter password | recruiter.AuthController | Authenticated recruiter, own account |
| Operator OTP | admin.ModerationController | Logged-in registered operator candidate; permit pre-OTP verification |
| Shared notifications/uploads/chat | `controller/user` controllers | Login plus owner, participant and account-state checks |
| Teams/issues/recruit writing | `controller/user` controllers | Developer, team/resource and GitHub permissions |
| Account payments / operator refunds | UserSubscription / AdminSubscription | Separate role implementations; shared PaymentGateway/repositories; distinct payer/target and admin checks |

- Apply authorization in `global.security` and services; package names grant no access. Operator privileges never bypass ordinary team/chat membership.
- The session cookie is an RS256 JWT; its SHA-256 hash stays linked to the DB session. Keep secrets in httpOnly cookies only. Screen claims do not replace current DB authorization. GitHub App JWT keys are separate from session keys.
- Responses keep unwrapped success bodies, cursor `{items, nextCursor}`, create/async statuses and `global.error` `{code, message, detail}`. Do not expose entities. Preserve per-endpoint `p00`/`pNN` OpenAPI tags at method level when classes split.


## 6. Realtime and role-specific business rules

| Kind | Path |
| --- | --- |
| WebSocket | `/ws` |
| STOMP SEND | `/app/chat-rooms/{roomId}/messages` |
| SUBSCRIBE | `/topic/chat-rooms/{roomId}` |
| SUBSCRIBE | `/user/queue/chat-rooms` |
| SUBSCRIBE | `/user/queue/notifications` |

- The single STOMP SEND is on `user.ChatController` → `user.ChatService`. Recruiter offer actions use `recruiter.ChatService`; role services implement their own handling on the same chat data model, not a neutral `ChatMessageService`.
- Authenticate CONNECT; authorize SEND/SUBSCRIBE; protect personal queues. Persist, commit, then publish; reconnect catches up via REST. Add no destinations or ticket API. These five paths are separate from the 205 REST endpoints.

| Business | Rule |
| --- | --- |
| Recruitment acceptance | `user.RecruitmentService` coordinates same-group team/chat/notification services and the transaction; GitHub org invite stays separate |
| GitHub/issues | Distinct user vs installation tokens; verify signatures; dedupe delivery IDs; refresh caches; reconcile misses |
| Chat | Dedupe by sender/client message ID; consistent read pointers; block-period/leave/hidden rules; team-chat exception per Policy |
| Notifications | Role-specific `create` with shared command/data (§4.1); creation joins the producing transaction; no external delivery |
| Payments | `user.SubscriptionService` and `admin.SubscriptionService` each verify their use case and PG result; share the technical `PaymentGateway` and data contracts, not a neutral `PaymentService` |
| Moderation / files / AI·ads·stats | Preserve Policy limits, snapshots, retention, privacy |

Do not hold a DB transaction open across a provider call. PostgreSQL is durable truth; Redis is queue/cache/rate-limit infrastructure. Keep the 69-table ERD and Flyway history; folder moves alone must not change schema or Nginx `/api` routing.


## 7. Webhook under integration

```text
GitHub
  → POST /api/v1/webhook/github
  → integration.github.GithubWebhookController
  → integration.github.GithubWebhookService
  → signature + delivery dedupe + durable receipt
  → async → business services / cache / chat linkage
```

Keep the existing URL and response contract. The webhook is external ingress, not a guest "public user" API; an HTTP ingress class may live under `integration`. Component-scan, security matchers and tests must not assume every `@RestController` sits under `controller`.


## 8. Runtime and implementation snapshot

Keep the existing Compose/Nginx/deployment setup. The proxy routes `/api/v1/` to Spring and `/ws` with upgrade headers; `/api/bff/` is reserved. See [Docker](../operations/02-docker.md) and [automatic deployment](../operations/04-automatic-deployment.md). Package moves must not change deployment or provider selection.

Implementation notes as of this document (not rules; re-check against code):
- Session cookies use RS256 JWTs. `user.GithubController`/`user.GithubService` exist for the documented installation spike. Role notification services stay internal.
- GitHub: the HTTP adapter needs no ambient DB transaction, webhook outcomes use short transactions, and duplicate dispatch uses a PostgreSQL session advisory lock. See [GitHub App operations](../operations/06-github-app.md) for token integration and live-spike prerequisites.
- Chat reads (page 16): list, unread summary, request accept/delete use the chat tables. Team rows take the name and photo from `teams`. Accept is 404 while either side blocks, and block/unblock publish `CHAT_ROOMS_CHANGED` to both users after commit when they share a 1:1 room.
- Chat send (page 17): a text send stores a TEXT row, updates the same-room last-message pointer, and publishes `{event:"MESSAGE",message}` on the room topic only after commit. A broker receipt is not the save acknowledgement.
- A replay of a stored client id publishes `{type:"CHAT_SEND_ACCEPTED"}` only on that sender's user queue.
- P17 share targets are a JPA read on `ChatRoomRepositoryCustom`, shared by picker eligibility and share-send authorization. Explicit shares serialize per sender, enforce 10/minute and 100/KST-day limits, and replay the original message for the same client id/room/target (409 for conflicting reuse). `SHARE_CARD` and pasted Linker URL payloads persist references only; REST and per-subscriber delivery resolve the current card, including blocks and hidden/deleted sources. Only configured `linker.chat.public-origins` qualify; no URL fetch occurs. External OG preview remains a separate pending endpoint.
- History GET applies the free-team 60-day window because no Flex entitlement exists (`flexSupported: false`).
- Team room info and moderation now read the V20 `teams`/`team_members` schema. Room info returns `team: {id, name, status, myRole}` for the caller, which the screen uses for other-message delete and @all. `DELETE .../members/me` is 1:1 only: a team room answers 403 `FORBIDDEN` and leaving a team stays page 09's flow. Share targets and STOMP writes require current team membership and ACTIVE/COMPLETED state; READ_ONLY/ARCHIVED/DELETED teams are excluded from sharing/writes.
- New block periods and chat text timestamps use the application clock truncated to microseconds.
- Reconnect uses `after`, which returns only newer ids and does not recover an older edit or delete. When `after` stops at 500 the client follows `nextAfter` until the gap is closed, then shows the 500+ notice and jumps to the last read position. A room with no message yet reloads the latest page instead of sending `after`.
- Author TEXT edit and soft delete, team unread members, and the caller's mute flag are implemented. The room topic also carries `EDIT`, `DELETE`, `READ`; other topic events are dropped. Transcript frames are replaced with the current safe row at delivery, and the client ignores an older snapshot arriving after a newer edit, delete or hide.
- Every message response carries `updatedAt`, the row's `updated_at` (microseconds), which moves on edit, delete, hide, unhide and restore. The client keeps the frame with the later `updatedAt` and keeps the one on screen when they are equal, so a restore after a hide reaches an open screen while a delayed older frame cannot undo a newer state. Rows without it fall back to comparing `editedAt`. Commit order is not delivery order. Publishing is not an outbox, so a crash after commit can drop the frame. V10 adds `edited_at` only.


## 9. Migration and open decisions

1. Keep routes, permissions, DTOs, OpenAPI tags and STOMP destinations stable. Never register old and new controllers on the same path.
2. Add paired entry services only with real endpoints in the same change; never bulk-scaffold. Use role-named services for real use cases and keep shared DTO/repository/entity contracts.
3. Verify build, security, transactions and STOMP after moves.

Still open: JWT/cookie rotation; BFF; payment trial/renewal; AI/mail providers (file storage is the server disk: `LocalObjectStorage` on the `linker_uploads` volume, served at `GET /files/{key}` as a static path outside `/api/v1`, user decision 2026-11-10); Included launch gates; remaining paired entry services.
