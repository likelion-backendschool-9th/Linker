# Linker Backend Blueprint

> 기준일: 2026-11-03 · **시스템별 WBS의 백엔드 구현 기준**
>
> [WBS](02-wbs.md)는 API·권한·담당·일정, [기존 ERD](01-erd.md)는 데이터, [Policy](../planning/04-policy.md)는 숫자·상태·예외·문구를 소유한다. 이 문서는 계층·Java 패키지·트랜잭션·연동과 코드 이행 기준을 정의한다. 시스템별 WBS에 대응하는 공식 백엔드 기준이며, 문서 작성이 클래스 이동이나 기능 구현 완료를 뜻하지 않는다.

**표기:** `[기준]`은 채택한 계약, `[현재]`는 저장소에서 확인한 구현, `[미정]`은 선택 또는 보완이 필요한 항목이다. 문서상 목표를 현재 구현으로 오인하지 않는다.

## 1. 설계 원칙

- Linker의 흐름은 **팀 탐색 → GitHub 팀 협업 → 완주·작업물 → 네트워크·채용 제안**이다. 범위는 [PRD](../planning/02-prd.md)·[MVP](../planning/03-mvp-definition.md)·[페이지 TODO](../planning/07-page-todo.md)를 따른다.
- **페이지는 화면·담당 단위, 시스템은 API 책임 단위**다. 대표 HTTP 컨트롤러 18개가 33개 페이지와 기반 00의 API를 제공한다. 화면 수에 맞춰 클래스를 만들지 않는다.
- Spring이 인증·권한·한도·상태·결제·트랜잭션의 최종 판단자다. 프론트 접근 가드와 향후 BFF는 이를 대신하지 않는다.
- GitHub는 조직·저장소·이슈·PR의 원본이다. Linker DB는 동기화된 캐시를 제공하며 채팅·지원·작업물·구독·신고는 직접 관리한다.
- Controller → Service → Repository의 세 계층을 유지한다. Entity·DTO는 데이터 표현이며 추가 처리 계층이 아니다. 같은 규칙·테이블을 역할별로 복제하지 않는다.
- Required/Included, PRD 우선순위, ERD의 필수/포함 표시는 서로 다른 분류다. Included의 지연 허용과 실제 출시 데모 조건은 MVP 기준으로 판단한다.
- 기존 ERD의 **69개 테이블**을 유지한다. 컨트롤러 통합을 위해 새 테이블·컬럼·상태를 추가하지 않는다. 데이터 모델 변경은 ERD·Policy·마이그레이션을 별도로 변경한다.

## 2. 현재 구현과 목표

| 항목 | 현재 저장소 | 적용할 기준·남은 작업 |
| --- | --- | --- |
| 프로젝트 | backend 단일 Gradle 프로젝트, Java 21·Spring Boot 4.1.2 | 기존 빌드 설정 유지. 이 문서는 버전 업그레이드 지시가 아님 |
| 패키지 | 기존 기반 코드를 controller/service/repository/entity/dto로 이동 완료 | 새 기능도 §4 계층에 구현. integration·async·global 유지 |
| HTTP | Auth·Catalog·Upload·Moderation·Github·Sitemap 6개 컨트롤러, 기존 12개 REST. 신고·차단 통합 | WBS의 18개 시스템으로 확장. 205개는 전체 설계 계약이며 구현 수가 아님 |
| DB | V1__step0_foundation.sql에 12개 테이블 생성 정의 | ERD 69개와 구분. 서버 적용 여부는 이 문서에서 확인하지 않음 |
| 세션 | 랜덤 비밀 토큰 쿠키, DB에는 SHA-256 해시. SessionService/SessionAuthenticationFilter 사용 | 문서상 JWT 목표와 차이가 있음. 토큰 전환 없이 JWT 구현 완료로 표시하지 않음 |
| STOMP·OpenAPI | WebSocket/STOMP 의존성·`/ws` 쿠키 핸드셰이크·SEND/SUBSCRIBE 가드 골격 있음. springdoc 없음 | OpenAPI 태그는 HTTP 컨트롤러 추가 시 적용. 채팅 영속·브로드캐스트는 page 16–17 |
| 파일 | ObjectStorage 인터페이스와 local/unconfigured 구현 | 객체 저장소 업체 미정. 로컬 구현이 원격 presign과 동일하다고 가정하지 않음 |
| 알림·제한 | NotificationService·RateLimit 관련 작업이 워킹트리에 있음 | 기존 작업을 보존. 미커밋 코드를 공용 브랜치 완료 상태로 표시하지 않음 |
| 운영 구성 | Compose·Nginx·main 배포 workflow와 운영 문서 존재 | §3 및 운영 문서 사용. 실제 서버 상태를 새로 확인한 결과는 아님 |

현재 구현을 설명하는 표는 작성 시점의 기록이다. 미래 클래스·어댑터 예시를 이미 존재하는 파일로 해석하지 않는다.

## 3. 실행·배포·외부 경계

```text
브라우저 / Expo WebView
  → 호스트 Nginx(HTTPS)
  → Compose proxy(127.0.0.1:3004)
      ├─ /              → Next.js web:3000
      ├─ /api/v1/       → Spring backend:8080
      ├─ /ws            → Spring WebSocket/STOMP 업그레이드(쿠키 인증 골격)
      └─ /api/bff/      → Next.js(예약 경로, BFF 구현 완료 아님)
Spring → PostgreSQL / Redis / 외부 연동 어댑터
```

- `[현재]` production.conf는 /api/v1을 Spring으로 직접 전달한다. 브라우저는 같은 origin을 사용하며 서버 요청은 API_INTERNAL_URL을 사용할 수 있다. 인증이 필요한 서버 요청은 현재 요청의 쿠키를 명시적으로 전달한다.
- `[미정]` BFF 도입은 별도 결정이다. 도입하더라도 HTTP·쿠키 전달 계층이며 DB·업무 규칙을 소유하지 않는다. WBS의 Spring API 계약을 자동 변경하지 않는다.
- `[현재]` compose.prod.yml은 DB·Redis·backend·web의 호스트 포트를 제거하고 proxy만 loopback 3004에 공개한다. main 배포 workflow는 CI → GHCR 이미지 → SSH 적용을 구성한다. dev 변경은 자동 운영 배포가 아니다.
- PostgreSQL은 영속 원본, Redis는 제한·큐·캐시·카운터다. Redis만으로 결제·채팅·알림의 영속 사실을 보장하지 않는다. 단일 서버 STOMP에 Redis 세션 분산이 이미 구현됐다고 가정하지 않는다.
- 파일 바이트는 ObjectStorage, 메타데이터는 uploaded_files에 둔다. 업체·리전·법률상 처리자 범위는 별도 결정한다.
- 실행·배포·원격 DB 접속은 [Setup](../operations/01-setup.md)·[Docker](../operations/02-docker.md)·[배포](../operations/03-deployment.md)·[자동 배포](../operations/04-automatic-deployment.md), scripts/remote_db.py를 따른다. 시크릿·개인 키·실제 비밀번호는 문서/로그에 쓰지 않는다.

## 4. Java 패키지와 클래스 책임

기본 패키지는 **com.linker.backend**, Gradle group은 기존 com.linker를 유지한다. 디렉터리와 HTTP 역할 prefix는 별개다.

### 4-1. 계층

| 계층 | 책임 | 금지 |
| --- | --- | --- |
| controller | HTTP 입력 검증·권한 선언·서비스 호출·응답 조립 | 비즈니스 규칙·직접 쿼리·Entity 응답 |
| service | 업무 규칙·유스케이스·트랜잭션·공유 동작 | Servlet 종속·역할/화면별 동일 규칙 복제 |
| repository | Entity 저장·조회·필요한 projection | 권한·요금제 결정·같은 테이블의 역할별 저장소 |
| entity | ERD의 영속 상태·관계·enum·상태 변경 | API JSON 계약으로 직접 사용 |
| dto | 입력·출력 계약, 공통 커서 형태 | JPA Entity·컨트롤러 옆의 DTO 배치 |
| integration | GitHub·PG·메일·푸시·스토리지·AI 어댑터 | 외부 응답을 검증 없이 업무 상태로 확정 |
| async | 커밋 이후 전달·소비·배치 진입점 | 컨트롤러 호출·업무 규칙의 별도 복제 |
| global | 설정·보안·JPA 공통·오류 | 기능별 서비스의 잡동사니 저장소 |

### 4-2. 목표 트리

아래 서비스·DTO는 대표 예시다. 필요한 기능과 함께 추가하며 빈 클래스·디렉터리를 일괄 생성하지 않는다.

```text
com.linker.backend
├─ BackendApplication
├─ controller
│  ├─ open          CatalogController, LegalController, SitemapController
│  ├─ user          UploadController, IssueController, NotificationController,
│  │                ModerationController, StatsController
│  ├─ admin         AdminController
│  └─ multi         AuthController, AccountController, GithubController,
│                   TeamController, ChatController, RecruitmentController,
│                   PostController, SubscriptionController, RecruiterAdController
├─ service
│  ├─ auth          SessionService, GithubLoginService, RecruiterAuthService
│  ├─ account       AccountService, AgreementService, RecruiterAccountService
│  ├─ profile       ProfileService, FollowService, StatsService
│  ├─ catalog       CatalogService
│  ├─ legal         LegalDocumentService
│  ├─ file          UploadService, ImageInspector
│  ├─ github        GithubInstallationService, GithubWebhookService, PullRequestService
│  ├─ team          TeamService, TeamMembershipService, InviteService, CompletionService
│  ├─ issue         IssueService, IssueSyncService, ProgressService
│  ├─ chat          ChatRoomService, ChatMessageService, ChatReadService,
│  │                ChatRequestService, ChatShareService, ChatSummaryService
│  ├─ notification  NotificationService, NotificationDeliverySchedule
│  ├─ recruit       RecruitPostService, ApplicationService
│  ├─ post          PostService, CommentService
│  ├─ feed          FeedService
│  ├─ moderation    ReportService, BlockService, SanctionService, AppealService, AuditService
│  ├─ subscription  SubscriptionService, PaymentService, EntitlementService
│  ├─ recruiter     RecruiterAdService
│  └─ sitemap       SitemapService, SitemapSource
├─ repository       account/, profile/, team/, issue/, chat/, notification/,
│                   recruit/, post/, moderation/, subscription/, recruiter/, file/, github/
├─ entity           위와 같은 업무별 하위 패키지: 테이블 책임별 Entity·enum, 역할별 복제 없음
├─ dto              common/, auth/, account/, profile/, catalog/, legal/, file/,
│                   github/, team/, issue/, chat/, notification/, recruit/,
│                   post/, moderation/, admin/, subscription/, stats/, recruiter/, sitemap/
├─ integration      github/, payment/, mail/, push/, storage/, ai/
├─ async            webhook/, schedule/, notification/
└─ global
   ├─ config        AppConfig, PlanLimits, LinkerProperties
   ├─ error         ApiException, ApiErrorBody, GlobalExceptionHandler, ErrorResponseWriter
   ├─ security      SecurityConfig, CurrentUser, AuthenticatedUser, SessionCookies,
   │                SessionAuthenticationFilter, DeveloperOnly, TeamRole,
   │                RateLimit, RedisRateLimiter, OriginCheckFilter, ...
   └─ jpa           BaseTimeEntity
```

- controller.open은 HTTP public 그룹의 Java 배치명이다. **public은 Java 예약어**이므로 패키지명으로 사용하지 않는다. open 패키지에 있다고 인증이 해제되는 것은 아니다.
- controller.multi는 public/user/recruiter/admin 또는 user/webhook처럼 호출 경계가 섞인 시스템이다. 권한은 메서드와 보안 필터가 결정한다. 고정된 controller.common 7개 규칙은 폐지한다.
- 세부 Repository·Entity 배치는 기존 ERD/Blueprint의 데이터 책임을 유지한다. 컨트롤러를 합쳐도 UserRepository를 시스템별로 복사하지 않는다. 다중 테이블 조회는 DTO projection·공유 조회 서비스를 사용할 수 있다.
- DTO는 dto/{업무}/request와 response를 사용한다. 단순 응답만 있는 catalog/legal/sitemap은 해당 dto 하위에 둘 수 있다. 내부 명령 타입은 service의 해당 업무에 둔다.
- global.error를 유지한다. global.exception·global.response·service.support·번호 페이지 패키지·계층이 섞인 domain·api.common을 새로 만들지 않는다.
- 리소스는 application.yml·db/migration/·필요 시 legal/, 테스트는 src/test/java 아래 동일 패키지를 따른다.

### 4-3. 컨트롤러 대응과 협업

| 컨트롤러 | 패키지 | 시스템 주담당 | REST | 대표 서비스 |
| --- | --- | --- | ---: | --- |
| AuthController | multi | A | 13 | Session·GithubLogin·RecruiterAuth |
| AccountController | multi | A | 18 | Account·Agreement·Profile·Follow |
| CatalogController | open | A | 2 | Catalog |
| LegalController | open | A | 2 | LegalDocument |
| UploadController | user | E | 2 | Upload |
| GithubController | multi | B | 5 | Installation·Webhook·PullRequest |
| TeamController | multi | B | 29 | Team·Membership·Invite·Completion |
| IssueController | user | C | 22 | Issue·IssueSync·Progress |
| ChatController | multi | D | 27 | Room·Message·Read·Request·Share·Summary |
| NotificationController | user | D | 7 | Notification |
| RecruitmentController | multi | E | 17 | RecruitPost·Application |
| PostController | multi | E | 21 | Post·Comment·Feed |
| ModerationController | user | E | 5 | Report·Block·Appeal |
| AdminController | admin | A | 13 | Report·Sanction·Appeal·Audit·Auth |
| SubscriptionController | multi | D | 11 | Subscription·Payment·Entitlement |
| StatsController | user | B | 3 | Stats·Entitlement |
| RecruiterAdController | multi | A | 7 | RecruiterAd·Entitlement |
| SitemapController | open | B | 1 | Sitemap |
| 합계 | | | 205 | |

WBS의 메서드 구현자와 시스템 주담당은 다르다. A의 보낸 제안 API는 ChatController, D의 이슈 카드 조회는 IssueController, D의 이의 제기 접수는 ModerationController에 구현한다. B는 운영 회원/감사와 운영 환불, C는 내 이슈·AI를 맡는다. 주담당은 해당 계약을 검토하며 기존 페이지 업무를 전부 인수하지 않는다.

## 5. HTTP·보안·OpenAPI·STOMP

### 5-1. HTTP와 권한

전체 계약은 [WBS §4](02-wbs.md#4-시스템별-작업과-rest-계약)의 **205개**다. 경로·메서드·쿼리·동작·권한은 보존하며 반환 필드를 임의로 추가하지 않는다.

| 호출자 | 기본 기준 | 추가 확인 |
| --- | --- | --- |
| public | 비로그인 허용·선택적 인증 | 회원 필드·차단·공개 가능 여부, 게스트 제한 |
| user | 로그인 회원 | 개발자 전용 동작·회원 상태·대상 소유권 |
| recruiter | RECRUITER 회원 | 제안 자격·차단·구직 상태·Scout 한도 |
| admin | 개발자 + admins + 운영 인증 | 리드 권한·재심자 분리·민감 열람 사유/감사 |
| webhook | GitHub 서명 | delivery 중복·설치/이벤트 유효성, 세션 인증으로 대체 금지 |

팀 권한·방 참가자·작성자·GitHub repo write·요금제는 독립 조건이다. 메서드별로 모두 확인한다. 혼합 클래스는 /api/v1에서 시작하고 메서드에 역할 prefix를 둔다. 서비스에서도 중요한 리소스 조건을 검증한다.

응답: wrapper 없는 본문, 생성 201·비동기 202·커서 {items, nextCursor}. 실패는 global.error의 {code, message, detail}. LOGIN_REQUIRED·DEVELOPER_ONLY·TEAM_ROLE_REQUIRED·BLOCKED_RELATION·RATE_LIMITED·PLAN_LIMIT·GITHUB_UNAVAILABLE 등 기존 오류 코드와 문구를 유지한다.

개인화 요금제는 Cache-Control: private, no-store. 프론트 서버 no-store와 계정별 쿼리를 함께 적용한다. public 경로의 선택적 인증 응답도 회원별 필드가 있으면 공개 캐시에 혼합하지 않는다.

### 5-2. 세션·회원 상태

- `[기준]` 토큰은 httpOnly 쿠키로 전달하고 JavaScript·네이티브 브리지·로그에 노출하지 않는다. 인증 정보는 사용자별 요청에서만 전파한다.
- `[현재]` SessionService는 랜덤 토큰 원문을 쿠키로, 해시를 user_sessions에 저장한다. 운영 OTP 시각과 admins 여부를 권한 판정에 사용한다.
- `[목표 차이]` 기존 AGENTS·프론트 문서는 JWT·라우팅 claims·부모 도메인 쿠키를 목표로 한다. 현재 구현은 JWT가 아니며 cookie domain은 설정값이다. JWT 도입·claims·회전·기존 세션 전환은 별도 구현 과제다. 이 문서로 opaque 세션을 최종 채택하지 않는다.
- 세션 기간·정지/탈퇴 상태·복구는 Policy를 따른다. proxy.ts는 UX 가드이며 서버 권한 확인을 대체하지 않는다. 운영 기능의 존재 숨김·404 등 화면 정책도 유지한다.
- 쿠키 기반 쓰기는 Origin/CSRF 방어가 필요하다. 현재 enforce-origin 기본 false는 운영 준비 완료를 뜻하지 않는다. 신뢰 프록시·허용 origin·Secure·domain은 실행 환경과 함께 설정한다.
- GitHub 로그인 state·returnTo·토큰, 회사 이메일 코드/비밀번호 재설정·실패 제한은 기존 WBS·Policy를 따른다. 가입 시 외부 토큰과 비밀번호는 암호화/해시로 구분해 저장한다.

### 5-3. OpenAPI

컨트롤러 클래스 통합과 문서 태그는 별개다. 기존 p00-common·pNN-page 태그를 **원래 API 소속 페이지에 따라 메서드별로** 유지한다. operationId·DTO·생성 클라이언트도 보존한다. 모든 페이지 태그를 통합 클래스에 붙여 Orval 출력을 중복시키지 않는다. 실제 태그가 없는 메서드는 기존 프론트 page slug에 맞춰 추가한다.

### 5-4. 실시간

| 구분 | 경로 | 책임 |
| --- | --- | --- |
| 연결 | /ws | WebSocket 설정·쿠키 인증 |
| SEND | /app/chat-rooms/{roomId}/messages | ChatController @MessageMapping |
| SUBSCRIBE | /topic/chat-rooms/{roomId} | 메시지·편집·삭제·읽음 |
| SUBSCRIBE | /user/queue/chat-rooms | 목록·미확인 요약 |
| SUBSCRIBE | /user/queue/notifications | 개인 알림·배지 |

연결뿐 아니라 SEND·SUBSCRIBE 때도 참여 자격과 개인 채널 소유권을 확인한다. 메시지는 DB 저장 후 커밋된 사실을 발행하며 재연결은 REST로 누락을 보충한다. STOMP는 메시지 영속 원본이 아니다. /api/v1 prefix나 별도 티켓 API를 추가하지 않는다.

## 6. 데이터·서비스·외부 연동

### 6-1. 데이터 기준

기존 ERD의 **필수 56 + 포함 13 = 69개 테이블**을 사용한다. bigint identity, timestamptz, 문자열 enum, BaseTimeEntity 공통 시각을 유지한다. visibility와 deleted_at은 분리하고 GitHub 캐시는 외부 ID·updated_at 기준으로 갱신한다. 화면/역할에 따른 같은 데이터의 중복 Entity·테이블을 만들지 않는다.

V1은 이미 존재하는 기반이다. 적용된 SQL을 재작성하거나 DB를 초기화하지 않는다. 스키마 변경은 ERD·WBS 참조·추가 마이그레이션을 함께 관리한다. 현재 ddl-auto=validate·Flyway 사용을 유지한다. DB 밖의 작성 초안·Redis 캐시·파일 바이트는 ERD가 정한 위치를 따른다.

### 6-2. 트랜잭션과 재시도

- 모집 수락은 지원 상태·정원·팀 멤버·채팅 참가자·인앱 알림의 한 업무 단위다. Team/Chat/Notification 서비스를 재사용하고 마지막 자리의 경쟁을 제어한다. GitHub 초대는 기존 별도 API다.
- 메시지 저장과 관련 상태, 신고와 증거, 운영 조치와 감사, 승인 결과와 구독 혜택은 각각 일관된 DB 단위로 처리한다. client_message_id+sender_id, delivery_id, order_id/payment_key 등 기존 중복 방지 키를 사용한다.
- PG·GitHub·푸시·객체 저장소 호출을 DB 트랜잭션에 원자적으로 포함됐다고 가정하지 않는다. 필요한 요청 상태를 저장하고 외부 결과를 확인한 뒤 DB에 반영한다. 외부 성공·DB 실패나 응답 유실을 재조회·멱등 처리로 복구한다.
- 알림·웹훅·동기화의 영속 상태와 Redis 신호를 구분한다. 새 outbox 테이블은 기존 ERD에 없으므로 이 문서에서 자동 도입하지 않는다. 추가가 필요하면 별도 데이터 모델 변경으로 다룬다.

### 6-3. 기능별 기준

| 영역 | 유지할 핵심 규칙 |
| --- | --- |
| GitHub | App 설치 토큰과 사용자 토큰 분리. 설치 반환 검증·웹훅 서명/중복·주기 동기화·최신 updated_at 우선. PR 채팅은 opened/review requested/merged/closed |
| 팀·초대 | 실제 팀 권한과 org owner 구분. 초대 notify는 TEAM_INVITE와 /invite/{code}. 인앱/외부 초대는 같은 코드와 랜딩 사용 |
| 이슈 | 생성/변경의 GitHub 권한, issue_sync_jobs로 후속 작업 상태. 보드·캘린더는 이슈 데이터 재사용. 내 이슈는 소속 팀 하나로 제한 |
| 채팅 | 팀/개인 요청, 발신자+client_message_id 중복 방지, 동일 방 읽음 포인터. 차단 기간 DM은 해제 후에도 표시 규칙 유지, 팀 채팅 예외. 수정·삭제 조건은 각각 Policy 기준 |
| 알림 | NotificationService.create가 인앱 생성 진입점. 업무의 알림 행과 전달 시각·읽음·푸시 상태 구분. 푸시 끄기는 인앱 기록 제거가 아님. 조용한 시간·Android 범위 유지 |
| AI | 요청자만 조회, Flex·팀 설정·범위/개수·보존 한도 확인. 숨김/삭제/사진/차단 대상 제외. 공유는 명시적 카드, 자동 이슈 생성 금지. 모델 선정 전 외부 전송 금지 |
| 구독 | 서버 금액·계정 종류·결제 대상 검증 후 승인/혜택 적용. 단건+만료 기반과 체험·갱신 포함 범위를 구분. 해지·환불·유예·기존 콘텐츠 유지 기준은 Policy |
| 광고 | Scout·관심 직군·하루 빈도·허용 URL·숨김/차단/만료 확인. 일별 합계만 저장하며 열람자 식별 목록 제공 금지 |
| 파일 | 발급→업로드→완료, 소유권·형식/MIME·용량·EXIF·리사이즈 확인. GIF 미리보기와 재생 정책 준수. 공개 파일과 채팅 파일의 접근 권한 구분 |
| 신고·운영 | 신고 당시 원문과 앞뒤 각 10개 이내 증거. 운영자에게 임의 대화 조회 권한 부여 금지. 제재·재심·민감 열람은 사유와 감사 기록 유지 |
| 개인정보 | 동의 버전·시각, 탈퇴 익명화·토큰 폐기, 목적별 보존 기준. 카드번호·비밀번호·토큰·메일 주소·메시지 본문을 로그에 남기지 않음 |

### 6-4. 배치

웹훅 소비/누락 보완, 이슈 동기화 재시도, 진행 스냅샷, 알림/푸시 전달, 구독·요청·광고 만료, 계정/콘텐츠 정리, 제재 만료, 일별 광고 집계, AI 만료는 async 아래에 진입점을 둔다. 업무 서비스·기존 상태를 재사용하고 중복 실행 가능성을 고려한다. 주기·시간대·기간은 ERD와 Policy를 따른다.

## 7. 기반 코드 정리 결과와 후속 구현

기반 코드의 아래 이동을 반영했다. 향후 추가 기능은 §4의 동일 계층 규칙을 따른다.

| 이전 위치·기능 | 현재 위치 |
| --- | --- |
| api.common.auth.AuthSessionController | controller.multi.AuthController에 기반 세션 API 통합 |
| api.common.tag.TechTagController | controller.open.CatalogController |
| api.common.upload.UploadController | controller.user.UploadController |
| api.common.report.ReportController, block.BlockController | controller.user.ModerationController |
| api.common.webhook.GithubWebhookController | controller.multi.GithubController의 서명 검증 진입점 |
| api.common.sitemap.SitemapController | controller.open.SitemapController |
| domain.account의 세션/온보딩 서비스 | service.auth / service.account |
| domain.account.Notification·알림 서비스/보조 타입 | entity.notification / service.notification |
| domain.account의 회원/인증 Entity·Repository | entity.account / repository.account |
| TechTag·JobCategory·관련 Repository | entity.profile / repository.profile |
| Admin·AdminRole·관련 Repository | entity.moderation / repository.moderation |
| domain.file/github/moderation/sitemap | service·entity·repository·dto의 같은 업무별 위치 |
| 요청/응답·BlockView·SitemapItem | dto의 해당 업무별 위치 |
| integration·async·global.error/security/config/jpa | 유지, 변경된 import·주입·테스트만 연결 |

1. 기존 12개 HTTP 경로·응답·권한과 12개 Entity의 JPA 매핑을 유지했다. 아직 없는 기능은 담당 일정에 맞춰 새 구조에 구현한다.
2. 기반 컨트롤러·DTO·서비스·Entity·Repository·관련 테스트를 이동했다. CatalogService를 통해 목록을 조회하고, SQL 삽입 보조 컴포넌트는 repository.moderation에 둔다. 같은 경로를 이전/새 컨트롤러에 중복 등록하지 않는다.
3. 진행 중인 NotificationService·RateLimit 변경을 보존하고 import·주입·테스트를 새 패키지에 맞췄다. Notification 생성 팩터리는 서비스 계층에서 호출할 수 있게 공개했다. 기능 정리와 무관한 로직 변경은 섞지 않는다.
4. WBS의 페이지 담당·시스템 검토·205개 계약을 유지한다. 패키지 이동으로 DB 테이블명·컬럼명·Flyway 이력을 바꾸지 않는다.

## 8. 확인 범위와 미확정 항목

문서 정합성은 18개 HTTP 컨트롤러·205개 REST·5개 실시간 경로·69개 테이블 기준이다. 코드 이행 시 기존 빌드와 필요한 HTTP 권한·업무 트랜잭션·STOMP 접근·중복 처리 검사를 적용한다. 아직 없는 기능의 완료를 문서 수량으로 판단하지 않는다.

| 항목 | 남은 결정·차이 |
| --- | --- |
| 출시 범위 | Included지만 데모에 필요한 채용 담당자·광고·AI·공유 등의 출시 조건 합의 |
| 세션 | JWT 문서 목표와 현재 랜덤 토큰 구현의 차이, 회전·수명·claims·쿠키 설정 |
| BFF | 예약 경로 이후 실제 도입 여부와 쿠키/서버 요청/Orval 변경 |
| 외부 연동 | GitHub Projects 필드·권한/재설치. Toss confirm/cancel HTTP 클라이언트(`integration.payment`) 스파이크 있음. 구독 테이블·checkout REST·체험/갱신 범위는 page 28–29 |
| 처리자·AI·스토리지 | 업체·리전·모델·용량·전송/보존 조건. 기존 예시에 나온 업체를 자동 채택하지 않음 |
| 개인정보·환불 | 미확정 보존 기간·혜택 사용 증빙과 법률 초안의 확정 절차 |
| 운영 | 현재 구성이 있는 것과 실제 운영 설정/백업/복구/인증 준비가 완료된 것은 구분 |

추가 기능·업체·스키마 변경은 관련 기준 문서부터 합의한다. 외부에서 관리하는 한국어 원본에는 이번 시스템별 컨트롤러와 구현 기준 변경을 함께 반영한다.
