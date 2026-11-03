# Linker Backend Blueprint (English)
> Korean reading copy: [05-backend-blueprint.ko.md](05-backend-blueprint.ko.md). Keep the two files the same. This English file is the copy agents follow.
> WBS ([02-wbs.md](02-wbs.md)) owns scope, controller ownership, HTTP paths, methods, permissions, and schedule. ERD ([01-erd.md](01-erd.md)) owns tables. Policy ([04-policy.md](../planning/04-policy.md)) owns limits and states. This blueprint owns architecture and the `com.linker.backend` package layout. A package move does not change an API contract. `[Confirmed]` is stated in a planning document; `[Proposal]` is an implementation recommendation; `[Unresolved]` is still open. Legal texts are drafts.
> Other sources: [01 Service Plan](../planning/01-service-plan.md), [02 PRD](../planning/02-prd.md), [03 MVP](../planning/03-mvp-definition.md), [05 Terms](../planning/05-terms-of-service.md), [06 Privacy](../planning/06-privacy-policy.md), [07 Page TODO](../planning/07-page-todo.md), [03 Frontend Blueprint](03-frontend-blueprint.md).
## 1. Principles
Linker connects team discovery, GitHub collaboration, portfolio posts, and recruiter offers. Spring Boot is the authority for auth, ownership, team role, limits, state, subscriptions, and transactions. The BFF forwards requests and cookies; it does not own rules or the database. GitHub is the source of truth for orgs, repos, issues, and PRs. Linker owns accounts, teams, applications, chat, posts, subscriptions, and moderation. Do not add post-MVP features or tables. Policy is the source for numbers. Do not hold a DB transaction open across an external call; use idempotency, sync-job state, and webhook dedup. Do not log tokens, passwords, message bodies, or email addresses.
One page has one owning controller. Page numbers are work ids, not Java packages. Services, repositories, and entities are shared by capability. Do not copy them per page or per role.
Labels: WBS `[Required]`/`[Included]` are schedule marks. PRD `P0`–`P3` are feature priority. ERD `🟢`/`🟡` are MVP-required / MVP-included tables. They are not the same scale. MVP Required is the flow that breaks without it; Included may slip. WBS can mark a work item `[Included]` even when the MVP demo still wants it (Scout ads). The product owner decides the launch gate.
## 2. Actors and areas

| Actor | Source | MVP access |
|---|---|---|
| Guest | No session; `public` | Read profiles, posts, recruit posts, feed. Writes require login. Search indexing follows POL-A-9. |
| Developer | GitHub; `user_type=DEVELOPER` | Profile, teams, issues, chat, subscriptions, job-seeking. |
| Recruiter | Company email + password; `RECRUITER` | Public reads, offers when job status allows, Scout ads. |
| Operator | Developer + `admins` + OTP | Reports, sanctions, audit. Lead: permanent ban, reversal, appeal review. |
| GitHub / Toss / email / push / storage | Server credentials | Identity and issue source of truth; test payments; recruiter mail; Android push; image bytes. |
`public` is not guest-only. A cookie on the same read API adds like, follow, and application state. Recruiter profiles are `noindex`.

| Area | Pages | Feature IDs |
|---|---|---|
| Account, profile, legal | 01–06, 00 session/tags | A-1–A-6, A-9, H-4 |
| GitHub and teams | 07–10 | T-1–T-4 |
| Issues | 11–15 | I-1–I-5, T-7 included |
| Chat, notifications | 16–18 | C-1–C-5, C-7, N-1 |
| Recruit | 19–21 | R-1–R-4 |
| Posts, feed | 22–24 | P-1–P-5, P-7 |
| Moderation | 25–27 | O-1–O-5 |
| Subscription, stats | 28–30 | S-1–S-10 |
| Recruiter | 31–33, 04–05 ads | H-1, H-3, H-5, H-7–H-9 |
| Files | 00 upload | shared |
There is no separate Project domain and no company-verification API. Completion uses `team_completions` and `completion_records`. Recruiting uses `recruit_posts` and `applications`.
MVP required: A-1–A-3, A-5, A-9, H-4; P-1, P-2, P-4, P-5; R-1–R-4; T-1–T-4; I-1–I-4; C-1, C-3, C-4, N-1; O-1–O-3, O-5; S-1–S-3. Included: A-4, A-6; P-3, P-7; I-5; C-2, C-5, C-7; O-4; S-4–S-10; H-1, H-3, H-5, H-7–H-9. Later: A-7, A-8, P-6, P-8, P-9, R-5, T-5, T-6, I-6–I-8, N-2, C-6, H-2, H-6, and Phase 4 ad analytics.
## 3. Runtime
Browser and Expo WebView share the Next.js UI. `[Proposal]` Browser HTTP goes to same-origin `/api/bff/...`, then Spring. RSC uses a server-only adapter with the request cookie, not its own Route Handler. Webhooks and Toss confirmation go straight to Spring. `/ws` is upgraded to Spring STOMP; a one-time STOMP ticket is not in the WBS. File bytes go to storage with a presigned URL; Spring checks permission and completion. The frontend blueprint still calls Spring via `API_BASE_URL`. BFF adoption is `[Unresolved]` (Section 10).
Spring owns the 69 tables in PostgreSQL. Redis holds rate limits, the webhook queue, STOMP session state, and ad counters, not durable truth. Object storage holds image bytes; `uploaded_files` holds metadata. Provider and region are undecided. Do not expose the Spring origin or secrets to the browser.
## 4. Packages
Base package `com.linker.backend` (Gradle `group` stays `com.linker`). Processing path: Controller → Service → Repository. Entity and DTO are representations, not extra layers. `integration`, `async`, and `global` stay. Do not recreate `api.common`, `api.pNN_*`, or a `domain` package that mixes layers. This document does not move Java files.

| Layer | Does | Does not |
|---|---|---|
| `controller` | Validate HTTP, apply the WBS permission, call services, map the response | Business rules, queries, returning entities |
| `service` | Rules and coordination, including the use-case transaction | Servlet types, a copy of the same rule per page or role |
| `repository` | Persistence for one entity | Business decisions, a second repository for the same table |
| `entity` | One class per ERD table, plus enums that are not tables | API JSON |
| `dto` | Request and response contracts | JPA, placement under `controller` |

Target tree. A class that is not in the repository yet is created with its page. The seven foundation controllers, `SessionService`, `UploadService`, `ReportService`, `BlockService`, `GithubWebhookService`, `SitemapService`, and the entities named in the move map below already exist under `api.common` or `domain`.

```text
backend/
├─ build.gradle, settings.gradle, gradlew, gradle/wrapper/
├─ src/main/java/com/linker/backend/
│  ├─ BackendApplication.java
│  ├─ controller/                 # caller role. One owning controller per WBS page.
│  │  ├─ common/AuthSessionController.java, TechTagController.java
│  │  │        UploadController.java, ReportController.java, BlockController.java
│  │  │        GithubWebhookController.java, SitemapController.java
│  │  ├─ public/LoginController.java, LegalController.java
│  │  │        RecruiterSignupController.java, RecruiterLoginController.java
│  │  ├─ user/OnboardingController.java, WorkspaceController.java
│  │  │      TeamCreateController.java, TeamSettingsController.java
│  │  │      IssueListController.java, IssueDetailController.java, IssueCreateController.java
│  │  │      BoardController.java, CalendarController.java
│  │  │      ChatListController.java, NotificationController.java
│  │  │      RecruitEditorController.java, PostEditorController.java
│  │  │      SubscribeController.java, SubscriptionManageController.java, StatsController.java
│  │  ├─ recruiter/RecruiterOfferController.java
│  │  ├─ admin/AdminReportController.java, AdminUserController.java, AdminAuditController.java
│  │  └─ multi/ProfileController.java, ProfileEditController.java, SettingsController.java
│  │           InviteController.java, ChatRoomController.java
│  │           RecruitListController.java, RecruitDetailController.java
│  │           PostDetailController.java, FeedController.java
│  ├─ service/                    # capability, shared by every role that needs it
│  │  ├─ auth/SessionService.java, GithubLoginService.java, RecruiterAuthService.java
│  │  ├─ account/AccountService.java, AgreementService.java
│  │  ├─ profile/ProfileService.java, FollowService.java, StatsService.java
│  │  ├─ legal/LegalDocumentService.java
│  │  ├─ github/GithubWebhookService.java, GithubInstallationService.java
│  │  ├─ team/TeamService.java, TeamMembershipService.java, InviteService.java
│  │  ├─ issue/IssueService.java, IssueSyncService.java
│  │  ├─ chat/ChatRoomService.java, ChatMessageService.java
│  │  │       ChatRequestService.java, ChatSummaryService.java
│  │  ├─ notification/NotificationService.java
│  │  ├─ recruit/RecruitPostService.java, ApplicationService.java
│  │  ├─ post/PostService.java, CommentService.java
│  │  ├─ feed/FeedService.java
│  │  ├─ moderation/ReportService.java, BlockService.java, SanctionService.java, AuditService.java
│  │  ├─ subscription/SubscriptionService.java, PaymentService.java, EntitlementService.java
│  │  ├─ recruiter/RecruiterAccountService.java, RecruiterAdService.java
│  │  ├─ file/UploadService.java
│  │  └─ sitemap/SitemapService.java
│  ├─ repository/                 # one interface per entity; same subpackages as entity
│  │  ├─ account/UserRepository.java, AuthIdentityRepository.java, UserSessionRepository.java
│  │  ├─ profile/TechTagRepository.java, FollowRepository.java
│  │  ├─ team/TeamRepository.java, TeamMemberRepository.java
│  │  ├─ issue/IssueRepository.java, IssueSyncJobRepository.java
│  │  ├─ chat/ChatRoomRepository.java, ChatMessageRepository.java
│  │  ├─ recruit/RecruitPostRepository.java, ApplicationRepository.java
│  │  ├─ post/PostRepository.java, CommentRepository.java
│  │  ├─ moderation/ReportRepository.java, UserBlockRepository.java, AdminActionRepository.java
│  │  ├─ subscription/SubscriptionRepository.java, PaymentRepository.java
│  │  ├─ recruiter/RecruiterAdRepository.java
│  │  ├─ file/UploadedFileRepository.java
│  │  ├─ github/GithubWebhookDeliveryRepository.java
│  │  └─ notification/NotificationRepository.java
│  ├─ entity/                     # one class per table; enums live in the same package
│  │  ├─ account/User.java, UserStatus.java, AuthIdentity.java, GithubToken.java, UserSession.java
│  │  ├─ profile/TechTag.java, Follow.java, JobCategory.java
│  │  ├─ team/Team.java, TeamMember.java
│  │  ├─ issue/Issue.java, IssueSyncJob.java
│  │  ├─ chat/ChatRoom.java, ChatMessage.java
│  │  ├─ recruit/RecruitPost.java, Application.java
│  │  ├─ post/Post.java, Comment.java
│  │  ├─ moderation/Report.java, UserBlock.java, Admin.java, AdminRole.java
│  │  ├─ subscription/Subscription.java, Payment.java
│  │  ├─ recruiter/RecruiterProfile.java, RecruiterAd.java
│  │  ├─ file/UploadedFile.java, UploadPurpose.java
│  │  ├─ github/GithubWebhookDelivery.java, WebhookStatus.java
│  │  └─ notification/Notification.java, PushToken.java
│  ├─ dto/
│  │  ├─ common/CursorPage.java
│  │  ├─ auth/response/MeResponse.java
│  │  ├─ profile/request/UpdateProfileRequest.java
│  │  │         response/TechTagResponse.java, PublicProfileResponse.java
│  │  ├─ file/request/CreateUploadRequest.java
│  │  │      response/CreateUploadResponse.java, CompleteUploadResponse.java
│  │  ├─ moderation/request/CreateReportRequest.java, CreateBlockRequest.java
│  │  │             response/BlockView.java
│  │  └─ sitemap/SitemapItem.java
│  ├─ integration/
│  │  ├─ storage/ObjectStorage.java          # exists
│  │  └─ github/, payment/, mail/, push/, ai/ # create with that adapter
│  ├─ async/
│  │  ├─ webhook/GithubWebhookConsumer.java  # exists
│  │  └─ schedule/                           # one component per Section 7 job
│  └─ global/
│     ├─ config/AppConfig.java, PlanLimits.java
│     ├─ error/GlobalExceptionHandler.java, ApiException.java, ApiErrorBody.java
│     ├─ jpa/BaseTimeEntity.java
│     └─ security/SecurityConfig.java, CurrentUser.java, DeveloperOnly.java, TeamRole.java
├─ src/main/resources/application.yml, db/migration/, legal/
└─ src/test/java/com/linker/backend/
   ├─ FoundationIntegrationTest.java
   ├─ controller/common/AuthSessionControllerTest.java
   ├─ controller/public/LoginControllerTest.java
   ├─ controller/user/IssueListControllerTest.java
   ├─ controller/multi/ProfileControllerTest.java
   ├─ controller/admin/AdminReportControllerTest.java
   ├─ controller/recruiter/RecruiterOfferControllerTest.java
   ├─ service/issue/IssueServiceTest.java
   ├─ service/recruit/ApplicationServiceTest.java
   ├─ repository/account/UserRepositoryTest.java
   └─ global/error/GlobalExceptionHandlerTest.java
```
`service.support`, `global.exception`, `global.response`, and `controller.webhook` are not packages. Profile, admin, and recruiter screens share `UserRepository`. Failures use `global.error`. Success bodies have no wrapper. `controller.common` is the seven foundation HTTP controllers. Security filters stay in `global.security`. Other request and response types follow the same `dto/<capability>/request|response` shape and are added with the endpoint. Other repositories follow the entity package of their table.
**Controller placement.** Use the WBS Permission and the `/api/v1/{role}` prefix. `@DeveloperOnly` and `@TeamRole` do not add a caller group. A page whose methods use more than one of `public`, `user`, `recruiter`, and `admin` goes in `controller.multi` and puts only `@RequestMapping("/api/v1")` on the class (pages 04, 05, 06, 10, 17, 19, 21, 23, 24). `AuthSessionController` also mixes `user` and `public` but stays in `common`. `RecruiterSignupController` and `RecruiterLoginController` are entirely `public`, so they stay in `controller.public`. `RecruiterOfferController` is `controller.recruiter`. The package name is not a security rule.
`@Tag` stays the frontend page slug (`p11-issue-list`, and the other `pNN-…` mock names). The seven foundation controllers share `p00-common`. Current Java has no `@Tag` yet; the first annotations use these names. STOMP stays on `ChatRoomController`: `/ws`, `/app/chat-rooms/{roomId}/messages`, `/topic/chat-rooms/{roomId}`, `/user/queue/notifications`, `/user/queue/chat-rooms`. Do not prefix those destinations with `/api/v1`.

| Pkg | Controller | Page | Owner | Service |
|---|---|---|---|---|
| common | `AuthSessionController` | 00 | A | `SessionService` |
| common | `TechTagController` | 00 | A | `ProfileService` |
| common | `UploadController` | 00 | E | `UploadService` |
| common | `ReportController` | 00 | E | `ReportService` |
| common | `BlockController` | 00 | E | `BlockService` |
| common | `GithubWebhookController` | 00 | B | `GithubWebhookService` |
| common | `SitemapController` | 00 | B | `SitemapService` |
| public | `LoginController` | 01 | A | `GithubLoginService` |
| user | `OnboardingController` | 02 | A | `AccountService`, `AgreementService`, `ProfileService` |
| public | `LegalController` | 03 | A | `LegalDocumentService` |
| multi | `ProfileController` | 04 | A | `ProfileService`, `FollowService`, `RecruiterAdService` |
| multi | `ProfileEditController` | 05 | A | `ProfileService`, `RecruiterAccountService` |
| multi | `SettingsController` | 06 | A | `AccountService`, `SessionService` |
| user | `WorkspaceController` | 07 | B | `TeamService`, `IssueService` |
| user | `TeamCreateController` | 08 | B | `TeamService`, `GithubInstallationService` |
| user | `TeamSettingsController` | 09 | B | `TeamService`, `TeamMembershipService` |
| multi | `InviteController` | 10 | B | `InviteService` |
| user | `IssueListController` | 11 | C | `IssueService` |
| user | `IssueDetailController` | 12 | C | `IssueService`, `IssueSyncService` |
| user | `IssueCreateController` | 13 | C | `IssueSyncService` |
| user | `BoardController` | 14 | C | `IssueService` (status change is the page-12 API) |
| user | `CalendarController` | 15 | C | `IssueService` |
| user | `ChatListController` | 16 | D | `ChatRoomService`, `ChatRequestService` |
| multi | `ChatRoomController` | 17 | D | `ChatRoomService`, `ChatMessageService`, `ChatRequestService`, `ChatSummaryService` |
| user | `NotificationController` | 18 | D | `NotificationService` |
| multi | `RecruitListController` | 19 | E | `RecruitPostService`, `ApplicationService` |
| user | `RecruitEditorController` | 20 | E | `RecruitPostService` |
| multi | `RecruitDetailController` | 21 | E | `ApplicationService` |
| user | `PostEditorController` | 22 | E | `PostService` |
| multi | `PostDetailController` | 23 | E | `PostService`, `CommentService` |
| multi | `FeedController` | 24 | E | `FeedService`, `RecruiterAdService` |
| admin | `AdminReportController` | 25 | A | `ReportService`, `SanctionService` |
| admin | `AdminUserController` | 26 | B | `SanctionService` |
| admin | `AdminAuditController` | 27 | B | `AuditService` |
| user | `SubscribeController` | 28 | D | `SubscriptionService`, `PaymentService` |
| user | `SubscriptionManageController` | 29 | D | `SubscriptionService`, `PaymentService` |
| user | `StatsController` | 30 | B | `StatsService`, `EntitlementService` |
| public | `RecruiterSignupController` | 31 | A | `RecruiterAccountService`, `AgreementService`, `SessionService` |
| public | `RecruiterLoginController` | 32 | A | `RecruiterAuthService` |
| recruiter | `RecruiterOfferController` | 33 | A | `ChatRequestService` |
40 controllers. REST totals in WBS §5 sum to 204 (12 foundation rows + 192 page rows). Counts are unchanged by this layout.
Shared pages keep the owner above. C adds `GET /api/v1/user/me/issues` on B's `WorkspaceController` (B reviews) and the AI summary on D's `ChatRoomController` (D reviews). B adds PR system messages on 17. E's accept transaction calls B's team membership and D's chat membership. Share actions call D's share-card API. 04, including recruiter screens, stays with A. 26, 27, and 30 stay with B.
**Services.** One `UserRepository` serves every role. Do not add `service.user.UsersService` or `service.admin.UsersService`. `PlanLimits` stays in `global.config`; `EntitlementService` reads it. `NotificationService.create()` is the only writer of `notifications`. Offer rows are chat rooms with `request_kind = RECRUITING`, read and written by `ChatRequestService`. `ApplicationService.accept` is the transaction for application state, headcount, team member, team-chat member, and notification. The GitHub org invite stays the page-09 endpoint and runs after commit.
**Entities.** One entity and one repository per ERD table. Package assignment: `account` users, auth_identities, github_tokens, user_sessions, user_agreements; `profile` tech_tags, user_tech_tags, username_redirects, contribution_days, follows, pinned_posts, profile_visits, user_job_categories; `file` uploaded_files; `github` github_installations, github_repos, github_webhook_deliveries; `team` teams, team_members, team_repos, team_invite_links, github_org_invitations, team_ownership_transfers, team_project_boards, board_status_mappings, team_completions, completion_records; `issue` issues, issue_assignees, issue_labels, issue_sync_jobs, pull_requests, team_progress_snapshots; `chat` chat_rooms, chat_room_members, chat_messages, chat_message_images, chat_message_mentions, ai_chat_summaries; `notification` notifications, push_tokens; `recruit` recruit_posts, recruit_roles, recruit_post_tags, applications; `post` posts, post_images, post_demo_links, post_tags, post_likes, comments, post_views; `feed` feed_seen_posts; `moderation` user_blocks, reports, report_cases, report_message_snapshots, sanctions, appeals, banned_github_ids, admins, admin_actions; `subscription` subscriptions, payments; `recruiter` recruiter_profiles, email_verifications, recruiter_ads, ad_hides, ad_daily_stats. That is 69. Enums that already exist (`UserStatus`, `UserType`, `JobSeekingStatus`, `AuthProvider`, `JobCategory`, `AdminRole`, `UploadPurpose`, `ReportReason`, `WebhookStatus`) stay beside those entities. `JobCategory` is not a table.
**DTOs.** Use `dto.<capability>.request` and `.response` when a capability has both. Legal and sitemap responses may sit directly in `dto.legal` and `dto.sitemap`. `dto.common.CursorPage` is the shared `{items, nextCursor}` shape. Name types by operation (`UpdateProfileRequest`). One public read API uses one response with optional member fields. Do not pre-create a DTO for every endpoint, and do not invent fields the WBS does not support.
**Repository root (actual).** `backend/` is one Gradle project (`build.gradle`, `settings.gradle`, `gradlew`, `Dockerfile`). Resources today: `application.yml` and `db/migration/V1__step0_foundation.sql`. Add `resources/legal/` with the page-03 slugs when that page is built. `BackendApplication` exists. Code today still lives under `api.common` and `domain`. Move map, without changing URLs or tags: the seven foundation controllers → `controller.common`; their request/response types → `dto`; `SessionService` → `service.auth`; onboarding helpers → `service.account`; `Notification` → `entity.notification`; `TechTag` and `JobCategory` → `entity.profile`; `Admin` → `entity.moderation`; file, github, moderation, and sitemap services → the matching `service` package; `SitemapItem` and `BlockView` → `dto`; `integration`, `async`, and `global` stay. Classes already present include those seven controllers, `SessionService`, `UploadService`, `ImageInspector`, `ReportService`, `BlockService`, `GithubWebhookService`, `SitemapService`, and entities `User`, `AuthIdentity`, `GithubToken`, `UserSession`, `TechTag`, `UploadedFile`, `GithubWebhookDelivery`, `Notification`, `UserBlock`, `Report`, `ReportCase`, `Admin`. Anything else in the table above is created with that page.
Tests mirror the same packages. Existing tests: `FoundationIntegrationTest`, `global.error.GlobalExceptionHandlerTest`, `ImageInspectorTest`, `GithubWebhookSignatureVerifierTest`. Add `*ControllerTest` for HTTP status and permission, `*ServiceTest` for the rule and transaction, and `*RepositoryTest` for one entity. `ApplicationServiceTest` covers accept. `UserRepositoryTest` covers `users` for every role.
## 5. Data
[01 ERD](01-erd.md) Sections 3–5 are authoritative: **56 🟢 + 13 🟡 = 69 tables**. PostgreSQL, `bigint identity`, `timestamptz`, string enums. Soft-delete user content with `deleted_at`; moderation visibility is separate (`VISIBLE`, `UNDER_REVIEW`, `HIDDEN`). GitHub values are caches keyed by GitHub id and `updated_at`. Linker posts, messages, applications, subscriptions, and moderation are not caches. Store UTC; apply KST only where policy says so. Do not add indexes the ERD does not justify.
Unique constraints to enforce from the ERD: provider identity, username, active team member, one team per installation, `(repo_id, issue_number)`, one post per author and repo, reactions and follows, `dm_key`, `client_message_id`, webhook delivery id, payment order, one ad per recruiter. Accept of the last seat is a conditional update in one transaction. Messages dedup on `client_message_id + sender_id`. Ads store daily aggregates only; Redis counters roll into `ad_daily_stats`. Per-viewer impressions are not a table.
Outside the database: Redis for limits, ad counters, and a 1-hour README cache; device drafts (7 days, not on the server); image bytes in object storage; encrypted GitHub tokens deleted on withdrawal. Draft retention, still subject to legal review: 30-day withdrawal grace; posts removed from the service immediately; team chat kept while the team exists, withdrawn author shown as a deleted user; DMs removed after both leave; reports about 1 year; payments follow a statutory period after review; AI results 7 days unless shared as a chat card. Banned-GitHub-id duration `[N years]` is unresolved.
## 6. HTTP API
WBS paths stay `/api/v1/{role}/{resources}`. `webhook` is an external ingress, not a person. The prefix does not grant access.

| Role | Rule |
|---|---|
| `public` | `permitAll` plus optional auth. Guest read limit 60/min per IP. |
| `user` | `authenticated`. Developer-only writes use `@DeveloperOnly`. |
| `recruiter` | `RECRUITER` account state. |
| `admin` | `admins` row, OTP, lead vs operator where the WBS says so. |
| `webhook` | GitHub signature, no session. |
`/api/v1/user/teams/{teamId}/...` uses `@TeamRole(MEMBER\|ADMIN\|OWNER)`. PRO/FLEX vs SCOUT is checked in the subscription service. Lists use `?cursor=&size=20` → `{items, nextCursor}`. Success is the body, 201 on create, 202 when async. Errors are `{code, message, detail}`: `LOGIN_REQUIRED`, `UNAUTHORIZED`, `DEVELOPER_ONLY`, `TEAM_ROLE_REQUIRED`, `BLOCKED_RELATION`, `RATE_LIMITED`, `PLAN_LIMIT`, `GITHUB_UNAVAILABLE`, `GITHUB_PERMISSION`, `SUSPENDED`. Do not invent per-route status codes the WBS does not give. A borrowed endpoint stays on its owning controller and `@Tag`.
Representative paths, not the full contract: `GET /api/v1/user/me`, `POST /api/v1/public/auth/refresh`, `POST /api/v1/user/uploads`, `GET /api/v1/public/users/{login}`, `/api/v1/user/teams/{teamId}/issues`, `/api/v1/user/chat-rooms/{roomId}/messages`, `GET /api/v1/public/feed`, `POST /api/v1/user/payments/confirm`, `GET /api/v1/recruiter/offers`, `POST /api/v1/recruiter/chat-requests`, `POST /api/v1/webhook/github`.
## 7. Behavior
**Auth.** Developers: GitHub OAuth with PKCE, one-time `state`, allowlisted `returnTo`. Recruiters: company-domain code (no free-mail providers), BCrypt password, reset codes hashed, short TTL, no account enumeration. `user_sessions` are the refresh sessions; 30-day sliding persistence is the policy draft. Access-token lifetime, rotation, reuse detection, and host-only vs parent-domain cookie are `[Unresolved]`. Frontend proposes `HttpOnly; Secure; SameSite=Lax` and claims `sub`, `typ`, `adm`, `onb`, `st`. Check order: session, account state, user type, team role, resource owner, GitHub permission, entitlement. `proxy.ts` does not replace Spring. Suspended users may only log in, view, appeal, or withdraw as policy allows. CSRF or a strict Origin check covers cookie writes. Encrypt GitHub tokens. Operators see report snapshots (10 messages of context), not arbitrary chats, and every sensitive read is audited.
**GitHub.** App installation tokens and user tokens are separate. Webhooks (`issues`, `pull_request`, `projects_v2_item`, `organization`, `installation`) are signature-checked, stored by delivery id, and processed on `async.webhook`. Re-query the installation from GitHub; do not trust the callback payload. Issues are created on GitHub first; `issue_sync_jobs` records the follow-up Projects steps. Stale events lose to a newer `updated_at`. App removal follows POL-T-3 (read-only, then archive after 30 days). Personal Projects are out of scope. Issue attachments are Linker file links, not a GitHub upload. PR chat events are opened, review requested, merged, and closed only. Screen reads use the cache. Projects v2 date and Blocked fields are a D1–D2 spike, still `[Unresolved]`.
**Chat and notifications.** PostgreSQL is the source of truth; STOMP only delivers. Persist, then broadcast. Reconnect fills gaps with REST. Block periods stay after unblock and hide DMs (team chat is exempt). Direct chat is immediate for mutual follows or the same team; otherwise it is a request with a 30-day expiry. Recruiter offers use `RECRUITING`. Edits and deletes last 24 hours. `NotificationService` writes the in-app row; push is async, Android only for MVP, and quiet hours apply to non-chat alerts. An outbox table is a `[Proposal]`, not an ERD table. Flex AI summary is on demand, excludes deleted, hidden, image, and blocked messages, returns 202 when slow, keeps the result 7 days for the requester, and shares it only as an explicit card. `LlmClient` hides the model. Do not send chat text to an external model until the provider is chosen, and do not auto-create issues from a summary.
**Subscription and ads.** Free, Pro, Flex, and Scout. The plans response is `Cache-Control: private, no-store` because trial eligibility is personal. The server sets price and owner; Toss confirm rechecks amount; entitlement flips once. Test mode and no real charges are `[Confirmed]`. Trial, billing key, and monthly renewal versus a one-time charge plus expiry are `[Unresolved]`. Prices in policy are mostly tentative. Recruiter email-domain check is not corporate verification. Offers require job status `OPEN` or `OFFERS_ONLY` and do not reveal contact details. One ad per recruiter, shown only to logged-in developers with a matching interest. The feed item has no URL; the click API returns it. `ad_daily_stats` is a daily aggregate.
**Files.** Presign → direct upload → complete. Check type and size, sniff MIME, resize the long edge to 2,048px, strip EXIF, and keep GIF to the first frame. Public files and chat files use different access rules. Storage vendor, region, and backup purge are `[Unresolved]`.
**Privacy.** Record consent version and time in `user_agreements`; optional consent does not block basic use. Do not store card numbers. Report evidence is the reported message plus limited context. Withdrawal, chat retention, processors, and cross-border transfer stay in Section 10 until legal review.
**Transactions.** Accept-application, message send, issue-sync job row, webhook delivery insert, Toss payment plus subscription, upload completion, and an admin action plus its audit row each commit in one DB transaction. External calls follow. Idempotency keys and unique constraints cover retries.
**Jobs** (ERD Section 6; confirm cron and timezone before coding): webhook consume and backfill, `issue_sync_jobs` retry, progress snapshots at 00:00 KST, push delivery, subscription and offer expiry, content and account purge, sanction expiry, daily ad aggregation, AI-summary purge after 7 days. Jobs must be safe to rerun.
## 8. Implementation order
Follow the WBS page order. Five people and two weeks are planning assumptions. New classes use Section 4. Settle BFF and cookie behavior before page work. Included features do not block the P0 path. Order: 00 foundation → 01–06 account → 07–10 teams → 11–15 issues → 16–18 chat → 19–21 recruit → 22–24 posts → 25–27 moderation → 28–30 payments → 31–33 recruiters and the 04/05/17/24 surfaces they share.
Tests prove the WBS contract: 401/403 by role, team role, optional-auth public reads, OAuth state, accept and webhook races, STOMP ACL, entitlement, and withdrawal of tokens. Sandbox checks of GitHub and Toss are separate from unit tests. Do not require tests for features excluded from the MVP.
Deploy checks, still open: host, domain, region, TLS, webhook URLs, `/ws` upgrade and sticky sessions, backups, secrets, migration rollback, and redaction. Sentry is a candidate, not a decision. Keep Toss test keys off production.
## 9. Checks
40 controllers, 204 REST endpoints, 5 realtime paths, 69 tables. Packages in Section 4. HTTP paths, permissions, `@Tag`, and STOMP destinations unchanged.
## 10. Unresolved

| Item | Still open |
|---|---|
| Launch gate | MVP demo wants Scout ads and some Included items; WBS defers Included first. Decide H-5/H-7–9, C-5, T-7, share cards, S-4–10. |
| BFF | Frontend calls Spring directly. Adopting `/api/bff` changes cookies, CORS, and Orval. |
| Sessions | httpOnly cookie and 30-day refresh are set. JWT vs opaque, rotation, and cookie domain are not. |
| GitHub Projects | Start/due/Blocked fields, free-org limits, and reinstall after app removal. |
| Toss | Test mode is set. Trial and billing-key renewal vs one-time charge plus expiry is not. Prices are mostly tentative. |
| Retention | Team-chat vs withdrawal, DM purge, report evidence, banned GitHub id `[N years]`, payment statutory period. |
| Processors | Host, email, storage, analytics, error, and AI vendors, regions, and transfer basis. |
| Ads | Redis counter loss and whether a reported ad is refunded. No per-viewer rows. |
| Files | Object-storage vendor, region, and who proxies large bodies. |
| Stats formulas | Completion rate denominator; what counts as a profile view. |
| AI | Ollama capacity vs an external model, training use, and the notice text. |
Realtime paths and the 204-endpoint total are resolved in the WBS. Do not reopen them when moving packages.
