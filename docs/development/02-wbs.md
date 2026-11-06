# Linker WBS — 시스템별 컨트롤러

> 기준일: 2026-11-03 · 상태: **시스템별 컨트롤러 기준 · 기반 코드 계층 정리 반영**
>
> 목적: **페이지별 화면 담당은 유지하고, API를 업무 시스템별 컨트롤러로 재구성한다.** 현재 공식 문서가 기준이며 기존 ERD·기능·HTTP 경로·권한·실시간 계약은 유지한다. 이 문서는 DB 재설계나 현재 구현 완료 보고서가 아니다.

읽는 순서: **0~3장 범위·책임·일정 → 4장 시스템별 API → 5장 페이지 작업 → 6~7장 통합·적용**. API 설명과 원본 세부 작업의 영문은 최신 WBS 계약 추적을 위해 보존했다.

## 0. 범위와 기준

| 항목 | 이전 기준 | 현재 기준 |
| --- | --- | --- |
| 화면 | 33개 + 공통 기반 00 | 유지 |
| HTTP 컨트롤러 | 40개: 페이지 33 + 공통 7 | 역할별 29개. 업무 시스템은 18개 유지 |
| REST API | **205개** | 한 API를 정확히 한 시스템에 배정 |
| 실시간 경로 | WebSocket 1 + SEND 1 + SUBSCRIBE 3 | 5개 유지, REST 합계와 별도 |
| DB | 기존 ERD의 69개 테이블 | 테이블·컬럼·enum 변경 없음 |
| 일정 | 5명·10개 작업일 D1~D10 | 기존 계획 유지, 실제 달력·진척률과 구분 |
| 범위 | Required / Included | 우선순위와 세부 기능 구분 유지 |

18개는 업무 시스템 수이고 실제 역할별 HTTP 컨트롤러는 29개다. 아래 시스템 추적명과 페이지의 API 소속 표기는 업무 책임을 설명하며 실제 Java 클래스 목록은 청사진 §4를 따른다. 공통 기능이어도 서비스는 Public/User/Recruiter/Admin 분류별로 구현한다. Entity·Repository·DTO·정책 상수는 공유할 수 있다. 단일 Spring 애플리케이션을 유지한다.

### 기준 문서

- 기능·완료 조건: [PRD](../planning/02-prd.md), [MVP](../planning/03-mvp-definition.md), [서비스 기획](../planning/01-service-plan.md)
- 숫자·상태·권한·예외·문구: [Policy](../planning/04-policy.md)
- 화면·URL: [페이지 TODO](../planning/07-page-todo.md)
- 테이블·컬럼·관계: [기존 ERD](01-erd.md), 특히 §7-2
- API·담당·일정의 기준은 이 문서다. 기존 페이지별 WBS의 계약을 유지하고 시스템 소속만 재편했다.
- 계층·Java 배치·프론트 규칙: [백엔드 Blueprint](05-backend-blueprint.md), [프론트 Blueprint](03-frontend-blueprint.md)

### 최신 변경 반영

- 09의 POST /api/v1/user/teams/{teamId}/invite-links/{linkId}/notify를 포함해 **205개 REST**다. UserTeamService는 UserNotificationService.create로 TEAM_INVITE와 link_path=/invite/{code}를 생성한다. 읽기는 18의 기존 API를 사용한다.
- 28 요금제는 체험 자격을 포함한 개인화 응답이다. 서버 Cache-Control: private, no-store, 프론트 서버 no-store·계정별 TanStack Query를 유지한다.
- 07의 /workspace/issues는 소속 팀 하나로 한정하며 joinedAt 기본 선택·/workspace 복귀 계약을 유지한다.
- 차단 해제는 user_blocks의 기간을 삭제하지 않으며 과거 DM 표시 판단에 활용한다.
- 기존 WBS의 “두 저장소” 가정은 현재 frontend/·backend/가 있는 단일 저장소에 맞게 해석한다. 배포 방식 변경은 이 작업의 범위가 아니다.

## 1. 담당과 협업

### 1-1. 페이지 담당 유지

| 담당 | 범위 | 페이지 |
| --- | --- | --- |
| A | 계정·채용 담당자·신고 운영 | 01~06, 25, 31~33 |
| B | GitHub·팀·운영·통계 | 07~10, 26·27·30, 17 PR 자동 게시 |
| C | 이슈·일정 | 11~15, 07 내 이슈, 17 AI 요약, 11 진행 현황 |
| D | 채팅·알림·구독 | 16~18, 28·29 |
| E | 모집·작업물·피드 | 19~24 |
| 전체 | 공통 기반 00 | 3장의 기능별 분담 |

### 1-2. 페이지 담당과 시스템 주담당 구분

- **페이지 담당:** 기존 화면과 해당 기능의 서버 구현·연동을 끝까지 담당한다.
- **시스템 주담당:** 아래 표의 기본 검토자다. 공통 API·DTO·서비스 계약과 파일 충돌을 조율하며 다른 사람의 페이지 업무를 전부 인수하지 않는다. 협업에 따른 담당 조정은 팀이 합의해 이 문서에 반영한다.
- **메서드 구현자:** 4장의 담당 열을 따른다. 예: 33은 A 구현·D 채팅 계약 검토, 07 내 이슈는 C 구현·B 화면 연결이다. 채팅의 이슈 카드 조회는 D가 C의 IssueController에 구현하고 C가 이슈 계약을 검토한다.
- API는 한 컨트롤러에만 등록한다. 다른 화면은 기존 API를 재사용한다. 복합 동작은 서비스를 조합하며 컨트롤러끼리 HTTP 호출하지 않는다.
- 공통 파일 변경은 작은 PR로 나누고 시스템 주담당과 해당 기능 담당자가 함께 검토한다. 한 페이지가 끝났다는 이유만으로 시스템 전체가 완료됐다고 표시하지 않는다.

### 1-3. 업무 시스템 목록

| ID | 시스템 | 업무 추적명(실제 역할별 클래스는 청사진 §4) | 시스템 주담당 | REST | API 출처 페이지 |
| --- | --- | --- | --- | ---: | --- |
| S01 | 인증·세션 | `AuthController` | A | 13 | 00, 01, 06, 31, 32 |
| S02 | 계정·프로필·관계 | `AccountController` | A | 18 | 02, 04, 05, 06 |
| S03 | 기준 목록 | `CatalogController` | A | 2 | 00 |
| S04 | 약관 문서 | `LegalController` | A | 2 | 03 |
| S05 | 파일 업로드 | `UploadController` | E | 2 | 00 |
| S06 | GitHub 연동 | `GithubController` | B | 5 | 00, 08, 09, 17 |
| S07 | 팀·초대·완주 | `TeamController` | B | 29 | 04, 07, 08, 09, 10 |
| S08 | 이슈·보드·일정 | `IssueController` | C | 22 | 07, 11, 12, 13, 14, 15, 17 |
| S09 | 채팅·요청·공유 | `ChatController` | D | 27 | 16, 17, 33 |
| S10 | 알림·푸시 | `NotificationController` | D | 7 | 06, 18 |
| S11 | 모집·지원 | `RecruitmentController` | E | 17 | 19, 20, 21 |
| S12 | 작업물·피드·반응 | `PostController` | E | 21 | 04, 22, 23, 24 |
| S13 | 신고·차단·이의 제기 | `ModerationController` | E | 5 | 00, 18 |
| S14 | 운영·감사 | `AdminController` | A | 13 | 25, 26, 27 |
| S15 | 구독·결제 | `SubscriptionController` | D | 11 | 26, 28, 29 |
| S16 | 개인 통계 | `StatsController` | B | 3 | 30 |
| S17 | 채용 광고 | `RecruiterAdController` | A | 7 | 04, 24 |
| S18 | 검색 색인 | `SitemapController` | B | 1 | 00 |
| 합계 | 18개 시스템 | 실제 HTTP 컨트롤러 29개 | | 205 | 00~33 |

회원 신고·차단은 UserModerationService, 운영 조치는 AdminService에서 각각 처리하며 데이터 계층을 공유한다. 운영 환불은 AdminSubscriptionController → AdminSubscriptionService로 배치한다. 중립 공용 서비스나 다른 역할의 서비스를 경유하지 않는다. 단, 신고 자동숨김의 시스템 운영자 알림은 청사진 §4의 명시적 예외다.

## 2. API·구현 규칙

서비스 생성은 [AGENTS의 필수 규칙](../../AGENTS.md#mandatory-backend-service-generation-rule)과 [청사진 §4](05-backend-blueprint.md#4-controller--service-11)를 따른다. 과거 세부 작업의 NotificationService·공용 서비스 표기는 중립 클래스 생성 지시가 아니라 현재 역할별 계약으로 읽는다. API 계약·담당·한도는 그대로 유지한다.

1. HTTP 경로는 /api/v1/{public|user|recruiter|admin}/{resources}, webhook은 GitHub 외부 입력 경로다. Java 패키지나 클래스명이 URL을 결정하지 않는다.
2. public은 비로그인 읽기·선택적 인증, user는 로그인 회원이다. 개발자 전용 동작의 @DeveloperOnly, 팀 API의 @TeamRole, 작성자·방 참가자·저장소 권한을 각각 보존한다. 운영 권한으로 타인의 대화·팀에 접근하지 않는다.
3. 컨트롤러는 public 루트 또는 user/recruiter/admin으로 나누고 원래 HTTP 역할 경로를 유지한다. 클래스가 폴더와 같은 권한을 자동 부여하지 않는다. user 전체를 개발자 전용이나 admin 전용으로 막지 않는다.
4. Controller → Service → Repository, com.linker.backend와 Blueprint의 레이어를 유지한다. 서비스는 공통 기능도 역할별 이름·폴더에서 각각 구현한다. 저장소·Entity·DTO·정책 상수는 업무별로 공유할 수 있고 DTO는 dto 아래에 둔다. 페이지 번호 패키지나 domain 혼합 배치로 되돌리지 않는다.
5. 공개(Public*) 컨트롤러는 `controller` 루트에 둔다. `public` / `public_` / `open` / `multi` 패키지는 쓰지 않는다. 로그인·채용·운영 API는 `controller.user` / `controller.recruiter` / `controller.admin`에 둔다. GitHub 웹훅 HTTP 진입은 `integration.github`에 둔다. 컨트롤러마다 같은 분류의 대응 진입 서비스를 둔다. 0단계 내부 역할 서비스는 실제 기능과 함께 컨트롤러 없이 추가할 수 있다. 빈 진입 서비스·빈 컨트롤러는 만들지 않는다. 공통 기반도 해당 시스템으로 통합하며 고정된 common 7개 규칙을 폐지한다. 구체적인 클래스 배치는 백엔드 Blueprint §3–§4를 따른다.
6. 기존 pNN OpenAPI 태그는 메서드별로 보존한다. 통합한 모든 태그를 클래스 전체에 붙이지 않는다. 태그 개편·Orval 재생성은 별도 합의다.
7. 메서드·경로·쿼리·권한·동작은 4장 원문 계약을 따른다. 클래스 통합을 이유로 API를 추가·병합하거나 권한을 넓히지 않는다.
8. ID는 Linker ID, 목록은 cursor/size와 {items, nextCursor}. 성공은 wrapper 없이 응답, 생성 201·비동기 접수 202, 오류는 {code, message, detail}. 기존 코드·한국어 문구를 유지한다.
9. 이슈·PR·조직은 GitHub 원본과 DB 캐시, 채팅·지원·결제·신고는 Linker 데이터다. 한도는 Policy·PlanLimits를 따른다.
10. STOMP는 HTTP 경로와 별도다. 4-19의 5개 경로를 공유하고 메시지 전송용 REST를 새로 만들지 않는다.

## 3. 일정과 공통 기반

### 3-1. D1~D10 계획

기존 일정·분담을 유지한다. 실제 진행 상황에 맞춰 남은 작업을 적용하며 D1부터 재시작하는 계획이 아니다. 시스템 전체를 한 번에 끝내지 않고 해당 화면에 필요한 기능을 순차 구현한다.

| 일차 | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- |
| D1 | 인증·권한·접근표·화면 골격 | App·웹훅·서버 기반 | Projects·정책/SEO 도구 | STOMP·Redis | 모노레포·Orval·API·오버레이 |
| D2 | 로그인 안내·03 | 설치 복귀·브리지·Expo | 캐시·프론트 테스트 기반 | 알림 서비스·실시간 클라이언트 | 공통 UI·업로더·신고/차단 |
| D3 | 01 | 07→08 | 11 | 16→17 | 19 |
| D4 | 02→06 | 08 | 11→12 | 17 | 20 |
| D5 | 04 1차 | 09 1차→10 | 12 | 17 | 21 |
| D6 | 05→25 | 09 2차 | 13 | 18 | 21→22 |
| D7 | 25→31 | 09 2차→17 PR | 13 | 17 개인 대화·제안 | 22 |
| D8 | 31→04 2차 | 26 | 14 | 28 | 23 |
| D9 | 32→33 | 27→30 | 15→07 내 이슈 | 28→29 | 24 |
| D10 | 채용 담당자 프로필·광고·직군 | 사이트맵·동기화·데모 | AI→진행 현황 | Scout→공유·링크 카드 | 광고 카드·공유 버튼 |

세부 반일 단위·1/2차 일정은 5장의 원본 값을 따른다. D10 Included는 조정 대상이며 필수 결제·알림·채팅까지 함께 미루지 않는다.

### 3-2. 공통 기반 00 — D1~D2

00은 화면이나 별도 CommonController가 아니다. 기존 12개 REST를 Auth·Catalog·Upload·Moderation·Github·Sitemap에 배정하고 역할별 서비스 생성 규칙을 적용한다. 프론트 도구·DTO·데이터 계약은 공유한다.

| 담당 | 산출물 |
| --- | --- |
| A | 회원/인증 수단·세션·httpOnly 쿠키·토큰 암호화, 회원 상태·개발자/운영 권한·선택적 인증·게스트 제한. 접근표·proxy·세션·역할별 레이아웃·화면 골격·로그인 안내 |
| B | App 권한·서명/웹훅 저장/큐·설치 반환·기존 서버 기반. 브리지 타입·WebView·딥링크·Android 뒤로 가기. 사이트맵 D10 |
| C | Projects 상태/날짜 필드·이슈 캐시, policy·포맷터·SSR·SEO·이미지 설정·기존 테스트 기반 |
| D | STOMP 인증/재연결, NotificationService.create·RateLimit·PlanLimits·Redis, Toss 승인/취소 연계, 공통 실시간 클라이언트 |
| E | 모노레포·Orval·API fetch·상태/URL 도구, 공통 UI·오버레이·업로더·신고/차단·초안/삭제/한도 안내 |
| 전체 | 오류·OpenAPI 태그 계약, Sentry, 화면별 MSW와 OpenAPI 정합성 |

세션 claims·쿠키 세부는 WBS 00과 프론트 Blueprint를 따른다. 화면 라우팅 claims만으로 서버 권한을 판단하지 않는다. 업체·배포·세션 상세의 미확정 항목은 이번 구조 변경에서 새로 결정하지 않는다.

### 3-3. 선행 의존성

- App 검증·팀/멤버·채팅방 기반이 11~17·21의 실제 연동보다 먼저 필요하다.
- D2에 NotificationService·신고·차단 인터페이스를 공유한다. 초대 알림은 B 생산·D 목록/전달이다.
- 지원 수락(E)은 팀 가입(B)·채팅 참여(D)를 재사용한다. GitHub 조직 초대는 별도 버튼/처리다.
- PR 자동 게시(B)는 Chat(D), 이슈 카드·AI 액션(C)은 Issue 계약을 사용한다.
- 31 이전 채용 대화는 테스트 계정으로 구현하고 실제 가입 후 31~33과 연결한다.
- 광고 계약은 A가 D9까지 공유, E는 mock으로 진행하고 D의 Scout 자격·만료와 연결한다.
- 페이지별 “new 테이블”은 최초 구현 연결일 뿐 독점 소유권이 아니다. 스키마는 기존 ERD를 따른다.

## 4. 시스템별 작업과 REST 계약

원래 페이지·구현자는 작업 추적 기준이다. 기존 기능·권한은 원문을 보존했다. 페이지가 Required여도 개별 Included 기능을 필수로 바꾸지 않으며 표시가 없는 세부 후순위는 5장 원본 목록을 함께 따른다.

### 4-1. 인증·세션 — `AuthController`

**시스템 주담당:** A · **REST:** 13개

- **범위:** GitHub 로그인, 회사 이메일 가입·로그인·비밀번호, 세션·로그아웃
- **주요 참조 데이터:** users, auth_identities, github_tokens, user_sessions, email_verifications. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 가입·복구·재발급·로그아웃이 동일한 세션 규칙을 따른다. 운영 OTP는 AdminService에서 운영 인증을 처리하고 세션 데이터 계약·보안 기반을 따른다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | A | GET | `/api/v1/user/me` | Session member (type, status, onboarding step, suspension info) | user |
| 00 | A | POST | `/api/v1/public/auth/refresh` | Extend session cookie | public |
| 01 | A | GET | `/api/v1/public/auth/github/authorize-url` | GitHub authorize URL + issue `state` (`client=web\|app`, `returnTo`) | public |
| 01 | A | POST | `/api/v1/public/auth/github/callback` | Exchange code → find/create member, refresh username → cookie. Response `{ isNew, restored, returnTo }` | public |
| 06 | A | POST | `/api/v1/user/auth/logout` | Log out (delete session) | user |
| 06 | A | PATCH | `/api/v1/recruiter/me/password` | `[Included]` Recruiter password change → end other sessions (after 32) | recruiter |
| 31 | A | POST | `/api/v1/public/recruiter-signup/email-codes` | Check company email (reject free domains and existing accounts) → send 6-digit code (once per minute) | public |
| 31 | A | POST | `/api/v1/public/recruiter-signup/email-codes/verify` | Verify code (10 min; new code after 5 wrong) → sign-up token | public |
| 31 | A | POST | `/api/v1/public/recruiter-signup` | Sign-up token + password, name, company, job title, website, consents → create in one transaction + login cookie | public |
| 32 | A | POST | `/api/v1/public/recruiter-auth/login` | Email + password (10-min lock after 5 failures), restore if pending withdrawal | public |
| 32 | A | POST | `/api/v1/public/recruiter-auth/password-reset-requests` | Send reset link (same response whether or not registered) | public |
| 32 | A | GET | `/api/v1/public/recruiter-auth/password-reset/{token}` | Whether link is valid (30 min, single use) | public |
| 32 | A | POST | `/api/v1/public/recruiter-auth/password-reset` | New password → end all other sessions | public |

### 4-2. 계정·프로필·관계 — `AccountController`

**시스템 주담당:** A · **REST:** 18개

- **범위:** 온보딩·동의, 프로필·팔로우, 설정·이메일·탈퇴
- **주요 참조 데이터:** users, user_agreements, user_tech_tags, user_job_categories, follows, recruiter_profiles, contribution_days, username_redirects. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 공개/비공개 필드와 회원 상태·탈퇴 기준을 유지한다. 작업물·팀·광고는 각 시스템 API로 조회한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 02 | A | GET | `/api/v1/user/onboarding` | Remaining steps + defaults loaded from GitHub | user |
| 02 | A | POST | `/api/v1/user/onboarding/agreements` | Age 14+, terms, privacy (required), marketing (optional) consent; store terms version | user |
| 02 | A | PUT | `/api/v1/user/onboarding/profile` | Save name, bio, blog, tech stack, looking for team, job-seeking status, then finish onboarding | user |
| 02 | A | PUT | `/api/v1/user/onboarding/email` | `[Included]` Entered only when no email came from GitHub | user |
| 04 | A | GET | `/api/v1/public/users/{login}` | Header (layout per member type), completion record, new username if changed. If logged in: follow relation, block check; "제안만 받기" (Offers only) shown to recruiters only | public |
| 04 | A | GET | `/api/v1/user/users/{login}/followers` | Followers sheet (people list, so login only) | user |
| 04 | A | GET | `/api/v1/user/users/{login}/followings` | Following sheet | user |
| 04 | A | POST | `/api/v1/user/users/{login}/follow` | Follow (200/day, notification) | user · developers only |
| 04 | A | DELETE | `/api/v1/user/users/{login}/follow` | Unfollow | user · developers only |
| 04 | A | GET | `/api/v1/public/users/{login}/contributions?month=` | `[Included]` One month of contribution graph + as-of time | public |
| 05 | A | GET | `/api/v1/user/me/profile` | Edit form values | user |
| 05 | A | PATCH | `/api/v1/user/me/profile` | Name, bio, blog, tech stack, looking for team, job-seeking status, `[Included]` job categories of interest (max 3) | user · developers only |
| 05 | A | POST | `/api/v1/user/me/profile/github-sync` | Reload from GitHub | user · developers only |
| 05 | A | PATCH | `/api/v1/recruiter/me/profile` | `[Included]` Recruiter name, company, job title, website (after 31) | recruiter |
| 06 | A | GET | `/api/v1/user/me/settings` | Linked GitHub, notification email, push enabled flag (read), current plan summary. Push toggle write is `PATCH /api/v1/user/me/settings/notifications` on NotificationController | user |
| 06 | A | PATCH | `/api/v1/user/me/email` | Change notification email | user |
| 06 | A | GET | `/api/v1/user/me/withdrawal-check` | Teams I own (must transfer or delete before next step) | user |
| 06 | A | POST | `/api/v1/user/me/withdrawal` | Pending withdrawal (deleted after 30 days) | user |

### 4-3. 기준 목록 — `CatalogController`

**시스템 주담당:** A · **REST:** 2개

- **범위:** 기술 태그·직군 목록
- **주요 참조 데이터:** tech_tags; 직군은 서버 설정. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 00에서 공통 조회 계약을 제공한다. 포함 기능인 직군 때문에 필수 기술 태그를 미루지 않는다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | A | GET | `/api/v1/public/tech-tags` | Tech stack tag list (sheets in 02, 05, 19, 20, 22) | public |
| 00 | A | GET | `/api/v1/public/job-categories` | `[Included]` Job category list (05 job categories of interest, 04 job ad sheet) | public |

### 4-4. 약관 문서 — `LegalController`

**시스템 주담당:** A · **REST:** 2개

- **범위:** 문서 본문·버전·시행일
- **주요 참조 데이터:** 자체 테이블 없음; 동의는 user_agreements. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 약관·개인정보·커뮤니티·사업자 문서를 가입·설정과 연결한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 03 | A | GET | `/api/v1/public/legal-documents` | Document list and current versions | public |
| 03 | A | GET | `/api/v1/public/legal-documents/{slug}` | `terms`, `privacy`, `community`, `recruiter-terms` body (Markdown), version, effective date | public |

### 4-5. 파일 업로드 — `UploadController`

**시스템 주담당:** E · **REST:** 2개

- **범위:** 업로드 발급·완료·이미지 검사/가공
- **주요 참조 데이터:** uploaded_files. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 기존 업로드 계약을 게시물·채팅·프로필에서 재사용하고 Policy의 형식·크기·가공을 적용한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | E | POST | `/api/v1/user/uploads` | Issue presigned upload URL (type, 10MB check) | user |
| 00 | E | POST | `/api/v1/user/uploads/{fileId}/complete` | Upload complete → resize, strip EXIF | user |

### 4-6. GitHub 연동 — `GithubController`

**시스템 주담당:** B · **REST:** 5개

- **범위:** App 설치 검증·웹훅·조직 초대·PR 조회/자동 게시
- **주요 참조 데이터:** github_installations, github_repos, github_webhook_deliveries, github_org_invitations, pull_requests. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 서명 검증·중복 수신·캐시·누락 동기화를 담당한다. PR 자동 게시는 Chat 서비스를 사용하며 새 REST를 만들지 않는다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | B | POST | `/api/v1/webhook/github` | Verify signature → save `github_webhook_deliveries` → Redis queue | webhook |
| 08 | B | GET | `/api/v1/user/team-setup/install-url` | GitHub App install URL + `state` | user · developers only |
| 08 | B | POST | `/api/v1/user/team-setup/installations/verify` | Don't trust the return values; verify via `GET /user/installations` → installed / requested from owner / org already linked | user · developers only |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/members/{userId}/github-invitation` | GitHub org invite (team owner who is also a GitHub org owner, daily limit error) | team OWNER + org owner |
| 17 | B | GET | `/api/v1/user/chat-rooms/{roomId}/pull-requests?state=` | PR sheet (open, merged) | team MEMBER |

00의 B 설치 스파이크는 위 08의 `install-url`·`installations/verify` 경로를 `UserGithubController` → `UserGithubService`로 먼저 제공한다. 현재 설치 확인 성공(`INSTALLED`)만 서버 토큰으로 확인하며, 오너 승인 대기·기존 팀 연결 결과와 영속 팀 생성은 08에서 연결한다. A의 사용자 토큰 공급 경로와 실제 App 검증이 필요하다. 자세한 연결·재시도 기준은 [GitHub App 운영 안내](../operations/06-github-app.md)를 따른다. API 소유·원래 페이지·205개 합계는 유지한다.

### 4-7. 팀·초대·완주 — `TeamController`

**시스템 주담당:** B · **REST:** 29개

- **범위:** 팀·멤버·역할·저장소/보드 연결·초대·오너 이전·완주
- **주요 참조 데이터:** teams, team_members, team_repos, team_invite_links, team_project_boards, board_status_mappings, team_ownership_transfers, team_completions, completion_records. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 팀 권한·정원·완주 기준을 유지한다. 초대 알림은 TEAM_INVITE와 /invite/{code}로 UserNotificationService.create를 사용한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 04 | A | GET | `/api/v1/public/users/{login}/teams` | 2nd pass: teams (active, completed) | public |
| 07 | B | GET | `/api/v1/user/me/teams` | My teams (grouped active / completed / read-only / archived), includes `joinedAt` for default team pick; also used by the team switcher sheet and 07 my-issues team picker | user · developers only |
| 08 | B | POST | `/api/v1/user/teams` | Create team + team chat room + register owner | user · developers only |
| 08 | B | GET | `/api/v1/user/teams/{teamId}/setup/repos` | Repos the app is installed on | team OWNER |
| 08 | B | PUT | `/api/v1/user/teams/{teamId}/setup/repos` | Set initial linked repos | team OWNER |
| 08 | B | GET | `/api/v1/user/teams/{teamId}/setup/boards` | `[Included]` Preview existing org boards (name, card count, status columns) | team OWNER/ADMIN |
| 08 | B | POST | `/api/v1/user/teams/{teamId}/setup/board` | Create new "Linker" board (4 statuses + date fields) or use existing board + status mapping | team OWNER/ADMIN |
| 08 | B | GET | `/api/v1/user/teams/{teamId}/setup/permission-check` | Whether org base repo permission is read | team OWNER |
| 08 | B | POST | `/api/v1/user/teams/{teamId}/setup/complete` | Queue first full sync (issues, PRs, org members) | team OWNER |
| 09 | B | GET | `/api/v1/user/teams/{teamId}/settings` | Team info, my role, which buttons are allowed, plan, board | team MEMBER |
| 09 | B | GET | `/api/v1/user/teams/{teamId}/members` | Members, roles, GitHub org status, "N/6" | team MEMBER |
| 09 | B | GET | `/api/v1/user/teams/{teamId}/invite-links` | Valid invite links | team ADMIN |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/invite-links` | Create invite link (7 days) | team ADMIN |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/invite-links/{linkId}/notify` | Notify a Linker developer (@handle) → `TEAM_INVITE` notification to `/invite/{code}` | team ADMIN |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}/invite-links/{linkId}` | Revoke invite link | team ADMIN |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/repos` | Add linked repo | team ADMIN |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}/repos/{repoId}` | Remove linked repo | team ADMIN |
| 09 | B | PATCH | `/api/v1/user/teams/{teamId}` | 2nd pass: name, description | team ADMIN |
| 09 | B | PATCH | `/api/v1/user/teams/{teamId}/members/{userId}/role` | 2nd pass: change role | team OWNER |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}/members/{userId}` | 2nd pass: remove member (admins can remove members only) | team ADMIN |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}/members/me` | 2nd pass: leave team (not owner) | team MEMBER |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/ownership-transfers` | 2nd pass: request owner transfer | team OWNER |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/ownership-transfers/{transferId}/accept` | 2nd pass: recipient accepts | team MEMBER (recipient) |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/completion` | 2nd pass: complete project → "작업물 올리기" (Post your project) notification to members | team OWNER/ADMIN |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}/completion` | 2nd pass: revert within 7 days | team OWNER/ADMIN |
| 09 | B | POST | `/api/v1/user/teams/{teamId}/archive` | 2nd pass: archive | team OWNER |
| 09 | B | DELETE | `/api/v1/user/teams/{teamId}` | 2nd pass: delete (confirm team name) | team OWNER |
| 10 | B | GET | `/api/v1/public/invites/{code}` | Link status (valid / expired / revoked). Payload may include team id for accept; UI does not render a team detail preview | public |
| 10 | B | POST | `/api/v1/user/invites/{code}/accept` | Add team member + join team chat. Already a member, member limit, over 10 teams returned as codes | user · developers only |

### 4-8. 이슈·보드·일정 — `IssueController`

**시스템 주담당:** C · **REST:** 22개

- **범위:** 이슈 생성·조회·변경, 상태 보드·캘린더·내 이슈·카드·진행 현황
- **주요 참조 데이터:** issues, issue_assignees, issue_labels, issue_sync_jobs, team_progress_snapshots. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** GitHub 원본·동기화 상태, 저장소 쓰기 권한, 내 이슈의 팀 범위와 Flex 진행 현황 기준을 지킨다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 07 | C | GET | `/api/v1/user/me/issues?teamId=` | `[Included]` Issues assigned to me **in that team only**, by due date (added by C on D9). `teamId` required and must be a team I belong to; otherwise 400 | user · developers only |
| 11 | C | GET | `/api/v1/user/teams/{teamId}/issues` | Filters: repo, status, assignee, label, open; cursor | team MEMBER |
| 11 | C | GET | `/api/v1/user/teams/{teamId}/issues/unscheduled` | "일정 없음" (Unscheduled) tab (not on board or no due date) | team MEMBER |
| 11 | C | GET | `/api/v1/user/teams/{teamId}/issue-filters` | Filter sheet options (repos, labels, members) — also used by 14 and 15 | team MEMBER |
| 11 | C | POST | `/api/v1/user/teams/{teamId}/issues/refresh` | Pull to refresh (once per minute) | team MEMBER |
| 11 | C | POST | `/api/v1/user/teams/{teamId}/issues/{issueId}/project-item` | "프로젝트에 추가" (Add to project) | team MEMBER + repo write |
| 11 | C | GET | `/api/v1/user/teams/{teamId}/progress?days=14` | `[Included]` Progress card: completion rate, 4 status counts, last 14 days of snapshots + today, open issues per assignee, overdue and due within 3 days. Free teams get 403 `PLAN_LIMIT` (after 28) | team MEMBER · Flex |
| 12 | C | GET | `/api/v1/user/teams/{teamId}/issues/{issueId}` | Body (sanitized Markdown), assignees, labels, dates, status, my write permission, deleted/moved state | team MEMBER |
| 12 | C | GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/assignee-candidates` | Assignee sheet (members with repo access who accepted the org invite) | team MEMBER |
| 12 | C | PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/assignees` | Assignees (max 10) → check GitHub response → notify | team MEMBER + repo write |
| 12 | C | GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/label-options` | Label sheet | team MEMBER |
| 12 | C | PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/labels` | Labels | team MEMBER + repo write |
| 12 | C | PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/schedule` | Start and due date (start ≤ due) | team MEMBER + repo write |
| 12 | C | PUT | `/api/v1/user/teams/{teamId}/issues/{issueId}/status` | Todo / In Progress / Blocked / Done (Done = close; reverting reopens) — borrowed by 14 | team MEMBER + repo write |
| 12 | C | GET | `/api/v1/user/teams/{teamId}/issues/{issueId}/sub-issues` | `[Included]` Sub-issue progress | team MEMBER |
| 13 | C | GET | `/api/v1/user/teams/{teamId}/issue-templates?repoId=` | Repo templates → org `.github` templates → 3 defaults | team MEMBER |
| 13 | C | GET | `/api/v1/user/teams/{teamId}/issue-templates/{templateKey}?repoId=` | Parsed template (Markdown body or issue form field list + default labels/assignees); falls back to default template on failure | team MEMBER |
| 13 | C | POST | `/api/v1/user/teams/{teamId}/issues` | Create issue → add to project → dates → status, in order; 202 + jobId (100/day) | team MEMBER + repo write |
| 13 | C | GET | `/api/v1/user/teams/{teamId}/issue-sync-jobs/{jobId}` | Creation progress, failed step | team MEMBER |
| 14 | C | GET | `/api/v1/user/teams/{teamId}/board` | Cards in 4 columns + "기타" (Other) column (same filters as 11) | team MEMBER |
| 15 | C | GET | `/api/v1/user/teams/{teamId}/calendar?from=&to=&assignee=` | Issues in range (start/due dates, KST) | team MEMBER |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/issue-cards?number=&repoId=` | #issue number → card (title only without permission) | team MEMBER |

### 4-9. 채팅·요청·공유 — `ChatController`

**시스템 주담당:** D · **REST:** 27개

- **범위:** 목록·메시지·읽음·검색·개인 요청·채용 제안·공유·AI 요약
- **주요 참조 데이터:** chat_rooms, chat_room_members, chat_messages, chat_message_images, chat_message_mentions, ai_chat_summaries. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 팀/개인 대화·재연결·읽음·차단 기간을 통일한다. AI는 C, 보낸 제안은 A가 구현하고 D가 채팅 계약을 검토한다.
- 페이지 16 목록 구현은 엔드포인트 4개를 추가하지 않는다. 응답은 `{items,nextCursor}`, 기술적 페이지 크기는 20이며 Policy 한도가 아니다. cursor는 마지막 가시 메시지 시각(없으면 방 생성 시각) 내림차순과 roomId 내림차순의 keyset이다. 토큰에는 버전·사용자·탭·정렬 시각·roomId가 들어가고, 요청 문맥과 다르면 400이다. 인코딩은 인증이나 변조 방지가 아니며 각 조회는 멤버십을 다시 확인한다. 실시간 재정렬의 스냅샷은 보장하지 않는다. 모집자 `TEAM`/`REQUEST`는 403, `DIRECT`는 허용한다. 수락·거절의 최초 전환이 커밋된 뒤에만 처리한 본인 `/user/queue/chat-rooms`로 `{type:"CHAT_ROOMS_CHANGED",roomId}`를 보낸다. `requestKind`는 `GENERAL`/`RECRUITING`이다. 팀 제목은 `teams`가 없어 null이며 `team_id` FK는 08 이후다. 메시지 `payload`·`client_message_id`·`edited_at`과 전송 API는 17이다. 무료 팀 60일 이력 제한은 구독 상태가 없어 목록에 적용하지 않는다. 삭제·숨김 메시지의 미리보기 문구는 Policy를 따르고, 미읽음 집계에서 빼는 규칙은 문서에 없어 ERD의 `id > last_read_message_id`에서 본인 메시지와 1:1 차단 기간만 제외한다. 거절 후 30일 재요청 금지는 방 생성(#98)이며 이 DELETE가 기간을 저장하지 않는다. GET은 EXPIRED를 저장하지 않는다.
- 페이지 17 텍스트는 기존 STOMP SEND와 `GET .../messages`, `POST .../read`만 구현한다. 방 정보 GET은 포함하지 않는다. 일반 페이지는 30건이고 `after` 복구 상한은 500이다. 500에서 더 있으면 `catchUpLimited`와 `nextAfter`를 반환하며 잘라 버린 뒤 영구 누락으로 처리하지 않는다. 항목은 id 오름차순이다. `before`와 `after`를 같이 주면 400이다. 팀 이력은 구독 행이 없어 최근 60일(`FREE_60_DAYS`, `flexSupported: false`)만 반환한다. 1:1에는 그 제한을 씌우지 않는다. 팀 전송은 팀 상태 테이블이 없어 거절한다. 전송 한도는 사용자별 `chat.send` 초당 5회이고 공유 버킷과 분리한다. 같은 발신자·같은 clientMessageId의 같은 요청은 한 행이다. 다시 보내면 새 행이나 상대 재방송 없이 기존 `/user/queue/chat-rooms`로 `{type:CHAT_SEND_ACCEPTED}`만 발신자에게 보낸다. 유니크 충돌로 이미 저장된 같은 요청도 같다. 커밋 뒤에만 `/topic/chat-rooms/{roomId}`로 `{event:"MESSAGE", message}`를 보내고, 수신 직전에 멤버십과 차단 기간을 다시 보고, `MESSAGE`·`EDIT`·`DELETE` 본문은 그 시점의 안전한 행으로 바꾼다. 커밋 순서가 소켓 도착 순서는 아니다. 같은 토픽의 `EDIT`·`DELETE`는 자리 표시가 적용된 메시지를, `READ`는 `{event,roomId,messageId}`만 보낸다. 그 외 이벤트 이름은 전달하지 않는다. 브로커 receipt는 저장 성공이 아니다. 프로세스가 커밋 직후 죽으면 방송이 빠질 수 있다. `after`는 더 새로운 id만 돌려주므로 예전 메시지의 수정·삭제를 복구하지 않는다. V10은 `edited_at`만 추가한다. `payload`는 아직 없다. 본인 TEXT 수정·삭제, 팀 안 읽은 참여자, 본인 음소거는 구현한다. 방 정보 GET과 팀 소유자/운영자의 타인 메시지 삭제는 `teams`·`team_members`가 없어 보류한다. 목록의 무료 60일 제한도 아직 적용하지 않는다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 16 | D | GET | `/api/v1/user/chat-rooms?tab=TEAM\|DIRECT\|REQUEST` | Room list (last message, unread count, muted), excluding blocked users | user |
| 16 | D | GET | `/api/v1/user/chat-rooms/unread-summary` | Unread count per tab, received request count (bottom tab badge) | user |
| 16 | D | POST | `/api/v1/user/chat-requests/{roomId}/accept` | Accept message request — also borrowed by the top of 17 | user |
| 16 | D | DELETE | `/api/v1/user/chat-requests/{roomId}` | Delete request (reject, sender not notified, blocks re-request for 30 days) | user |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}` | Room info, members, my notification setting, request status | room participant |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/messages?before=&after=` | Infinite load upward, missed messages after reconnect, handles 500+ | room participant |
| 17 | D | POST | `/api/v1/user/chat-rooms/{roomId}/read` | Last read message | room participant |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}/unread-members` | Unread-by sheet (team) | room participant |
| 17 | D | PATCH | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}` | Edit (within 24 hours) | author |
| 17 | D | DELETE | `/api/v1/user/chat-rooms/{roomId}/messages/{messageId}` | Delete (team owner/admin can delete others') | author / team ADMIN |
| 17 | D | PATCH | `/api/v1/user/chat-rooms/{roomId}/notification` | Mute | room participant |
| 17 | D | DELETE | `/api/v1/user/chat-rooms/{roomId}/members/me` | Leave 1:1 chat | room participant |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/images` | `[Included]` Photo gallery | room participant |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/mention-candidates` | @mention autocomplete | team MEMBER |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/link-preview?url=` | `[Included]` First external link preview (1:1 only for mutual follows; server fetches OG tags). Linker URLs skip OG; the server turns them into `payload.linkerCard` when saving the message | room participant |
| 17 | D | GET | `/api/v1/user/chat-rooms/{roomId}/search?q=` | `[Included]` Team chat search (free 60 days, Flex full history). The message list also doesn't return messages older than 60 days for free teams (30-day grace after Flex ends) | team MEMBER |
| 17 | D | GET | `/api/v1/user/me/share-targets?q=` | `[Included]` Chat room list for the share sheet (my team rooms + open 1:1 rooms, most recent first, excluding pending requests, blocks, read-only and archived teams) | user |
| 17 | D | POST | `/api/v1/user/chat-rooms/{roomId}/share-cards` | `[Included]` Share to chat room: `{targetType: POST / RECRUIT_POST / PROFILE, targetId}` → `SHARE_CARD` message + STOMP send (10/min, 100/day) | room participant |
| 17 | D | POST | `/api/v1/user/chat-rooms/direct` | Start 1:1 chat: room if mutual follow / same team, otherwise request | user · developers only |
| 17 | C | POST | `/api/v1/user/chat-rooms/{roomId}/ai-summaries` | `[Included]` Create AI summary (range; checks Flex (incl. trial), team setting on, 10/person/day; free teams get 403 `PLAN_LIMIT` → Flex prompt sheet; 202 if over 30 s) | team MEMBER · Flex |
| 17 | C | GET | `/api/v1/user/chat-rooms/{roomId}/ai-summaries/{summaryId}` | `[Included]` Summary result (own only, 7 days) — borrowed by 13 to prefill from action items | requester |
| 17 | C | POST | `/api/v1/user/chat-rooms/{roomId}/ai-summaries/{summaryId}/share` | `[Included]` Share to chat → `AI_SUMMARY` card message | requester |
| 17 | D | POST | `/api/v1/recruiter/chat-requests` | `[Included]` Recruiting offer request (`request_kind = RECRUITING`, 1,000 chars, no photos, 10/day or 50 with Scout; rejected if job-seeking is OFF, or if a request to the same developer is pending or was rejected within 30 days) | recruiter |
| 33 | A | GET | `/api/v1/recruiter/offers?status=TALKING\|WAITING\|NO_RESPONSE` | Sent offers (rejected shows WAITING for 30 days, then NO_RESPONSE — rejection is never in the response) | recruiter |
| 33 | A | GET | `/api/v1/recruiter/offers/counts` | Count per tab | recruiter |
| 33 | A | GET | `/api/v1/recruiter/offers/summary` | My page summary (in conversation, awaiting reply, offers left today N/10, Scout N/50, latest 3) — borrowed by 04 | recruiter |
| 33 | A | GET | `/api/v1/recruiter/offers/{roomId}/first-message` | Sheet with the first message I sent | recruiter |

### 4-10. 알림·푸시 — `NotificationController`

**0단계 생성 계약 복원:** UserNotificationService·RecruiterNotificationService·AdminNotificationService가 각각 `create(CreateNotificationCommand)`를 제공한다. 접두사는 생성 업무의 접근 경계이며 수신자 계정 종류가 아니다. 입력 DTO·Entity·Repository·정책 상수는 공유하고 서비스는 다른 역할을 호출하지 않는다(아래 신고 자동숨김 예외 제외). 호출 인자·오류·트랜잭션·야간 지연·미정 사항은 [백엔드 청사진 §4](05-backend-blueprint.md#4-controller--service-11)를 따른다. 기존 작업 목록의 NotificationService 표기는 이 역할별 계약으로 읽는다. 목록/읽음/푸시 API는 페이지 18에서 구현하며 이번 복원은 REST 205개·테이블 69개를 늘리지 않는다.

**신고 알림 freeze:** 최초 자동숨김(`auto_hidden_at` 최초 설정, 서로 다른 유효 신고자 `PlanLimits.REPORT_AUTO_HIDE_REPORTERS`명) 때만 E의 UserModerationService가 활성 운영자별 AdminNotificationService.create를 호출한다. type은 `REPORT_AUTO_HIDDEN`, 권장 linkPath는 `/admin/reports`, groupKey는 `report-auto-hidden:{caseId}`다. 피신고자·신고자에게 생성하지 않는다. 중복 생산 방지는 E 담당이며 groupKey 자체는 중복 방지 장치가 아니다. 기존 야간 지연을 유지하고 REST·테이블은 추가하지 않는다.


**시스템 주담당:** D · **REST:** 7개

- **범위:** 인앱 목록·읽음·배지·기기 토큰·푸시 설정
- **주요 참조 데이터:** notifications, push_tokens; 설정 원본 users.push_enabled. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 역할별 알림 생성 계약과 STOMP·Android 푸시를 제공한다. 초대 코드 연결을 유지하며 이의 제기는 Moderation 소속이다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 06 | A | PATCH | `/api/v1/user/me/settings/notifications` | Push on/off (`users.push_enabled`; off stops push only) | user |
| 18 | D | GET | `/api/v1/user/notifications` | Notification list (with target URL) | user |
| 18 | D | GET | `/api/v1/user/notifications/unread-count` | Header bell badge | user |
| 18 | D | PATCH | `/api/v1/user/notifications/{notificationId}/read` | Mark read | user |
| 18 | D | POST | `/api/v1/user/notifications/read-all` | Mark all read | user |
| 18 | D | POST | `/api/v1/user/push-tokens` | Register Expo push token (Android app) | user |
| 18 | D | DELETE | `/api/v1/user/push-tokens/{token}` | Delete token (logout) | user |

### 4-11. 모집·지원 — `RecruitmentController`

**시스템 주담당:** E · **REST:** 17개

- **범위:** 모집·지원·수락·거절·취소
- **주요 참조 데이터:** recruit_posts, recruit_roles, recruit_post_tags, applications. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 수락은 Team·Chat 서비스와 연결한다. GitHub 조직 초대 버튼은 별도 GitHub 기능이다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 19 | E | GET | `/api/v1/public/recruits?role=&tech=&mode=&sort=` | Open posts, newest / deadline soon; excludes blocked relations if logged in | public |
| 19 | E | GET | `/api/v1/user/me/recruits` | My recruit posts tab | user · developers only |
| 19 | E | GET | `/api/v1/user/me/applications?status=` | My applications tab (in review, accepted, rejected, expired) | user · developers only |
| 19 | E | DELETE | `/api/v1/user/me/applications/{applicationId}` | Cancel an in-review application — also borrowed by 21 | user · developers only |
| 20 | E | GET | `/api/v1/user/recruit-editor/options` | Teams that can be linked (owner/admin), remaining concurrent posts (3/10) | user · developers only |
| 20 | E | POST | `/api/v1/user/recruits` | Create (5/day, concurrent 3 / Pro 10) | user · developers only |
| 20 | E | GET | `/api/v1/user/recruits/{recruitId}/edit-form` | Edit form values + roles that can't be removed, minimum headcounts | author |
| 20 | E | PUT | `/api/v1/user/recruits/{recruitId}` | Edit | author |
| 20 | E | POST | `/api/v1/user/recruits/{recruitId}/close` | Close — also borrowed by 21's menu | author |
| 20 | E | POST | `/api/v1/user/recruits/{recruitId}/reopen` | Reopen | author |
| 20 | E | DELETE | `/api/v1/user/recruits/{recruitId}` | Delete (expire pending applications + notify) | author |
| 21 | E | GET | `/api/v1/public/recruits/{recruitId}` | Body, remaining headcount per role, author card. If logged in: my application status, whether already a team member, whether I'm the author | public |
| 21 | E | POST | `/api/v1/user/recruits/{recruitId}/applications` | Apply (1 role + 300 chars, 20/day, one re-apply) | user · developers only |
| 21 | E | GET | `/api/v1/user/recruits/{recruitId}/applications?roleId=` | Applicants tab (days left until 14-day expiry) | author |
| 21 | E | GET | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}` | Application sheet (stack, contribution graph, posts, completion record, message) | author |
| 21 | E | POST | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}/accept` | Accept → team member + team chat + notification. No team, role full, team limit returned as codes | author |
| 21 | E | POST | `/api/v1/user/recruits/{recruitId}/applications/{applicationId}/reject` | Reject (reason internal; applicant gets fixed copy) | author |

### 4-12. 작업물·피드·반응 — `PostController`

**시스템 주담당:** E · **REST:** 21개

- **범위:** 게시물·README·댓글·좋아요·피드·프로필 작업물·대표 고정
- **주요 참조 데이터:** posts, post_images, post_demo_links, post_tags, post_likes, comments, pinned_posts, feed_seen_posts. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 공개 읽기·회원 쓰기·작성자 권한·차단·숨김·추천 규칙을 유지한다. 동일 접근 분류의 광고/통계 서비스를 호출하고 데이터 계약을 공유한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 04 | A | GET | `/api/v1/public/users/{login}/posts` | 2nd pass: project posts (pinned first) | public |
| 04 | A | PUT | `/api/v1/user/me/pinned-posts` | 2nd pass `[Included]`: pin featured posts and order (free 1, Pro 5) | user · developers only |
| 22 | E | GET | `/api/v1/user/post-editor/repos?q=&teamId=` | Public repos of my account and my orgs, marking already-posted and forks; preselected when coming from a team | user · developers only |
| 22 | E | GET | `/api/v1/user/post-editor/repos/{repoId}/summary` | Repo card (name, language, stars, description), my commit count, issues handled in Linker | user · developers only |
| 22 | E | POST | `/api/v1/user/posts` | Publish (10/day, photos 5 / Pro 10) | user · developers only |
| 22 | E | GET | `/api/v1/user/posts/{postId}/edit-form` | Edit form values | author |
| 22 | E | PUT | `/api/v1/user/posts/{postId}` | Edit ("수정됨" (Edited)) | author |
| 23 | E | GET | `/api/v1/public/posts/{postId}?from=` | Post (repo state, commit/issue counts, like count, "검토 중" (Under review) to the author if hidden). If logged in: my like, view logging (traffic source: feed, profile, recruit post, chat share, external link `from=share`) | public |
| 23 | E | GET | `/api/v1/public/posts/{postId}/readme` | `[Included]` README (1-hour cache, sanitized), expand logged if logged in | public |
| 23 | E | POST | `/api/v1/user/posts/{postId}/likes` | Like (notification) | user · developers only |
| 23 | E | DELETE | `/api/v1/user/posts/{postId}/likes` | Unlike | user · developers only |
| 23 | E | GET | `/api/v1/user/posts/{postId}/likes` | Likers sheet (people list, so login only) | user |
| 23 | E | GET | `/api/v1/public/posts/{postId}/comments` | Comments and one-level replies | public |
| 23 | E | POST | `/api/v1/user/posts/{postId}/comments` | Write comment (500 chars, 10/min and 300/day, notification) | user · developers only |
| 23 | E | PATCH | `/api/v1/user/posts/{postId}/comments/{commentId}` | Edit comment | comment author |
| 23 | E | DELETE | `/api/v1/user/posts/{postId}/comments/{commentId}` | Delete comment ("삭제된 댓글입니다" if it has replies) | comment author / post owner |
| 23 | E | DELETE | `/api/v1/user/posts/{postId}` | Delete post | author |
| 23 | E | GET | `/api/v1/public/posts/{postId}/same-repo-posts` | Other posts for this repo | public |
| 24 | E | GET | `/api/v1/public/feed?cursor=&offersOnly=` | Guests: this week's popular + newest only. Logged in: 1 recommendation per 4 following posts, one-line "why shown", max 2 in a row from the same author. `offersOnly` = recruiter "제안 받는 개발자만" (Only developers open to offers) | public |
| 24 | E | POST | `/api/v1/user/feed/seen` | Log posts shown on screen (to exclude from recommendations) | user |
| 24 | E | GET | `/api/v1/user/feed/recommended-users` | Empty feed: 5 developers by my tech stack | user |

### 4-13. 신고·차단·이의 제기 — `ModerationController`

**시스템 주담당:** E · **REST:** 5개

- **범위:** 회원 신고·차단 목록/추가/해제·이의 제기 접수
- **주요 참조 데이터:** user_blocks, reports, report_cases, report_message_snapshots, appeals. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 신고 중복·증거 범위·차단 기간을 관리한다. 운영 조치는 Admin이 동일 서비스를 사용한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | E | POST | `/api/v1/user/reports` | Report (target type, id, reason; for chat, copy 10 before/after) | user |
| 00 | E | GET | `/api/v1/user/me/blocks` | Blocked users list (06) | user |
| 00 | E | POST | `/api/v1/user/blocks` | Open a blocking period (idempotent while active) | user |
| 00 | E | DELETE | `/api/v1/user/blocks/{userId}` | Close the active blocking period; retain history for DM filtering | user |
| 18 | D | POST | `/api/v1/user/appeals` | Appeal a sanction (once) | user |

### 4-14. 운영·감사 — `AdminController`

**시스템 주담당:** A · **REST:** 13개

- **범위:** 신고 처리·재심·OTP·회원 제재·이메일 열람·감사
- **주요 참조 데이터:** admins, admin_actions, sanctions, banned_github_ids; 신고·회원 참조. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** A는 25, B는 26·27을 구현한다. 운영자/리드·OTP·재심자 분리·감사 기준을 유지한다. 환불 API는 Subscription 소속이다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 25 | A | GET | `/api/v1/admin/report-cases?status=&targetType=&overdue=` | Pending / handled / appealed, target type (`[Included]` incl. RECRUITER_AD), flag over 2 business days | admin |
| 25 | A | GET | `/api/v1/admin/report-cases/{caseId}` | Report reasons, content, the copied 10 before/after for chat | admin |
| 25 | A | POST | `/api/v1/admin/report-cases/{caseId}/actions` | Hide / delete (reason required) / dismiss / restore → notify author and reporters | admin |
| 25 | A | GET | `/api/v1/admin/appeals?status=` | Appeals list | admin |
| 25 | A | POST | `/api/v1/admin/appeals/{appealId}/decision` | Accept (restore + delete record) / reject. Only an operator other than the original handler | admin |
| 25 | A | POST | `/api/v1/admin/otp/verify` | `[Included]` OTP 2FA | admin |
| 26 | B | GET | `/api/v1/admin/users?q=&status=&userType=&needsReview=` | Search, status and member type, "확인 필요" (Needs review: 3× limits) | admin |
| 26 | B | GET | `/api/v1/admin/users/{userId}` | Basic info (email masked), sanction and report history, subscription and payments; for recruiters: company, domain, job title, 30-day offers sent and accepted | admin |
| 26 | B | POST | `/api/v1/admin/users/{userId}/sanctions` | Sanction (warning → 7 days → 30 days → permanent by lead), reason required, notify | admin |
| 26 | B | DELETE | `/api/v1/admin/users/{userId}/sanctions/{sanctionId}` | Lift sanction (lead) | admin (lead) |
| 26 | B | POST | `/api/v1/admin/users/{userId}/email-reveal` | Reveal full email after entering a reason (logged) | admin |
| 27 | B | GET | `/api/v1/admin/audit-logs?adminId=&actionType=&from=&to=` | Who, when, what, why | admin |
| 27 | B | GET | `/api/v1/admin/audit-logs/filters` | Operator and action type options | admin |

### 4-15. 구독·결제 — `SubscriptionController`

**시스템 주담당:** D · **REST:** 11개

- **범위:** 요금제·체크아웃·승인·실패·해지·환불·결제 담당자
- **주요 참조 데이터:** subscriptions, payments. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 서버 Toss 테스트 승인 후 혜택을 반영한다. 개인화 요금제 no-store 유지. 운영 환불은 B 구현·D 결제 로직 검토로 연계한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 26 | B | POST | `/api/v1/admin/payments/{paymentId}/refund` | `[Included]` Refund (Toss payment cancel) | admin |
| 28 | D | GET | `/api/v1/user/plans?reason=` | Developers: Free / Pro / Flex; recruiters: `[Included]` Scout only. Monthly and yearly prices (Flex and Scout monthly only), entry reason, free trial eligibility. Personalized response: `Cache-Control: private, no-store`; frontend server `no-store`, no shared Next cache | user |
| 28 | D | GET | `/api/v1/user/plans/team-candidates` | My teams that can upgrade to Flex (owner / billing owner) with current headcount and price (₩7,900 up to 6, ₩1,900 per member from the 7th) | user · developers only |
| 28 | D | POST | `/api/v1/user/payments/checkout` | Create order (orderId, amount, customerKey). Checks plan matches member type | user |
| 28 | D | POST | `/api/v1/user/payments/confirm` | Success return: activate subscription + apply `PlanLimits` only after Toss confirm API verification (Scout = one job ad, 50 offers per day) | user |
| 28 | D | POST | `/api/v1/user/payments/{orderId}/fail` | Record failure return | user |
| 29 | D | GET | `/api/v1/user/me/subscriptions` | My subscription and team subscriptions I pay for (Scout for recruiters), next billing / expiry date, next Flex headcount and amount | user |
| 29 | D | GET | `/api/v1/user/me/payments` | Payment history | user |
| 29 | D | POST | `/api/v1/user/me/subscriptions/{subscriptionId}/cancel` | Cancel (kept until period end) | user |
| 29 | D | POST | `/api/v1/user/me/payments/{paymentId}/refund` | Refund (within 7 days + benefits unused) | user |
| 29 | D | POST | `/api/v1/user/me/subscriptions/{subscriptionId}/billing-owner` | `[Included]` Hand over Flex billing owner | user · developers only |

### 4-16. 개인 통계 — `StatsController`

**시스템 주담당:** B · **REST:** 3개

- **범위:** 작업물 통계·유입·채용 담당자 조회 수
- **주요 참조 데이터:** profile_visits, post_views; posts·반응·구독 참조. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 본인 범위·무료/Pro 구분을 지키고 채용 담당자 신원을 제공하지 않는다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 30 | B | GET | `/api/v1/user/me/stats/summary` | Free: likes, comments and views per post | user · developers only |
| 30 | B | GET | `/api/v1/user/me/stats/recruiter-views?weeks=8` | Pro: recruiter view count (this week, by week). Count only, never who | user · developers only · Pro |
| 30 | B | GET | `/api/v1/user/me/stats/posts?days=30` | Pro: per-post views by traffic source, 30-day trend, README expands | user · developers only · Pro |

### 4-17. 채용 광고 — `RecruiterAdController`

**시스템 주담당:** A · **REST:** 7개

- **범위:** 광고 등록·상태·클릭·닫기·숨기기
- **주요 참조 데이터:** recruiter_ads, ad_hides, ad_daily_stats. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** A는 등록/운영, E는 피드 동작 구현. Scout·직군·빈도·URL·차단 규칙을 적용하며 개인별 열람 테이블을 추가하지 않는다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 04 | A | GET | `/api/v1/recruiter/me/ad` | `[Included]` My job ad (status, subscription state). Empty if none | recruiter |
| 04 | A | PUT | `/api/v1/recruiter/me/ad` | `[Included]` Register/edit job ad (job category, title, URL, closing date). Allowed-domain URL check, Scout subscription check, 10/day | recruiter |
| 04 | A | PATCH | `/api/v1/recruiter/me/ad/status` | `[Included]` Turn showing on/off (ACTIVE ↔ PAUSED) | recruiter |
| 24 | E | POST | `/api/v1/user/ads/{adId}/click` | `[Included]` Record click → return posting URL (frontend opens it via the external link sheet) | user · developers only |
| 24 | E | POST | `/api/v1/user/ads/{adId}/dismiss` | `[Included]` X close (7 days) | user · developers only |
| 24 | E | DELETE | `/api/v1/user/ads/{adId}/dismiss` | `[Included]` Undo close (toast) | user · developers only |
| 24 | E | POST | `/api/v1/user/ads/{adId}/hide` | `[Included]` Hide this ad (permanent) | user · developers only |

### 4-18. 검색 색인 — `SitemapController`

**시스템 주담당:** B · **REST:** 1개

- **범위:** 색인 가능한 공개 콘텐츠 조회
- **주요 참조 데이터:** 자체 테이블 없음; users, posts, recruit_posts 참조. 전체 연결은 기존 ERD §7-2와 5장.
- **완료 기준:** 개발자 프로필·작업물·열린 모집 글만 노출하고 숨김·삭제·정지·탈퇴 대기·채용 담당자는 제외한다.

| 원래 페이지 | 구현자 | 메서드 | 경로 | 기존 기능·범위 | 권한 |
| --- | --- | --- | --- | --- | --- |
| 00 | B | GET | `/api/v1/public/sitemap/{kind}?page=` | Search-indexable list (`kind` = `posts` / `recruits` / `users`, 50k per page, only id, URL values, updated time). Excludes hidden, deleted, suspended, pending withdrawal and recruiters; recruit posts only while open (04 Policy POL-A-9) | public |

### 4-19. 공유 실시간 계약 — REST와 별도

| 구분 | 경로 | 책임 |
| --- | --- | --- |
| WebSocket 연결 | /ws | D: 인증 인터셉터·공통 연결. STOMP 목적지 아님 |
| STOMP SEND | /app/chat-rooms/{roomId}/messages | D: ChatController @MessageMapping |
| SUBSCRIBE | /topic/chat-rooms/{roomId} | D: 메시지·편집·삭제·읽음 |
| SUBSCRIBE | /user/queue/chat-rooms | D: 16 목록·미확인 요약 |
| SUBSCRIBE | /user/queue/notifications | D: 알림·배지, 18 공유 |

B의 PR 자동 게시와 C의 AI 공유는 생성 업무에 맞는 역할별 채팅 서비스를 사용한다. 목적지를 추가하지 않으며 참여 자격·개인 구독 권한을 서버에서 제한한다.

## 5. 페이지별 작업·일정·참조

페이지는 화면·담당·납기 단위, 시스템은 API 책임 단위다. 아래는 **기존 페이지의 일정·선행·근거와 원본 작업 전체**를 보존한 것이다. 원본의 borrowed·과거 컨트롤러명은 추적 정보이며 API의 새 소속은 4장을 따른다. 상세 내용을 접어 개요부터 읽을 수 있게 했다.

### P01. 시작·로그인 `[Required]` · `/auth/callback`

**핵심 산출물:** 둘러보기·GitHub 로그인, 앱 복귀·콜백·복구·실패 처리.

**담당:** A · **일정:** D3 (1 day) · **선행:** 00 · **근거:** A-1

**API 소속:** `AuthController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: `GET /api/v1/user/me` (if logged in, go to `/feed`)
- Tables: new banned_github_ids · shared users, auth_identities, github_tokens, user_sessions
- [ ] Server: auto-restore if within 30-day pending withdrawal, reject permanently banned GitHub ids, extend session 30 days
- [ ] Frontend: 3 intro blocks, "둘러보기" (Browse, `/feed` without login), "GitHub로 시작" (Start with GitHub; system browser in WebView), callback loading, `state` check, failure screen, "계정을 복구했어요" (Account restored) toast, `[Included]` "채용 담당자이신가요?" (Are you a recruiter?) link (after 31)

</details>

### P02. 온보딩 `[Required]` · `/onboarding`

**핵심 산출물:** 약관·연령 동의와 프로필 단계, 재개·태그·구직 상태·완료 세션.

**담당:** A · **일정:** D4 morning (0.5 day) · **선행:** 01 · **근거:** A-1, A-2, A-3, H-4

**API 소속:** `AccountController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: `GET /api/v1/public/tech-tags`, `GET /api/v1/public/legal-documents/{slug}` (03)
- Tables: new user_agreements, user_tech_tags · shared users, tech_tags (seed, created in 00)
- [ ] Server: store GitHub verified email (not shown), tech stack seed
- [ ] Frontend: stepped (terms → profile), resume where left off, tech stack sheet (max 10), job-seeking status picker component (reused in 05)

</details>

### P03. 약관 문서 `[Required]` · `/legal/[slug]`

**핵심 산출물:** 문서 본문·목차·버전·시행일·문의 연결.

**담당:** A · **일정:** D2 afternoon (0.5 day) · **선행:** 00 · **근거:** MVP launch condition

**API 소속:** `LegalController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: none (documents are server resource files; version compared at consent)
- [ ] Frontend: Markdown rendering, table of contents, effective date and version, contact email link

</details>

### P04. 프로필 `[Required]` · `/u/[login]`

**핵심 산출물:** 회원 종류별 공개 프로필·관계·완주·기여, 2차 작업물/팀과 채용 담당자 화면.

**담당:** A · **일정:** 1st pass D5 (1 day), 2nd pass D8 afternoon (0.5 day), recruiter side D10 morning (incl. job ad sheet) · **선행:** 02; 2nd pass 22; recruiter side 31; job ad 28 · **근거:** A-2, A-4, A-5, A-6, P-5, P-7, C-4, H-7, S-10

**API 소속:** `AccountController`, `PostController`, `TeamController`, `RecruiterAdController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: block/report (00), "메시지" (Message) / "채용 제안 보내기" (Send recruiting offer) → `POST /api/v1/user/chat-rooms/direct` / `POST /api/v1/recruiter/chat-requests` (17), recruiter my page summary → `GET /api/v1/recruiter/offers/summary` (33)
- Tables: new follows, 🟡 contribution_days, 🟡 username_redirects, 🟡 pinned_posts (2nd pass), 🟡 profile_visits (2nd pass), 🟡 recruiter_ads (recruiter side) · shared users, user_tech_tags, user_blocks, notifications, completion_records, posts, team_members, recruiter_profiles (after 31)
- [ ] Server: daily contribution scheduler, recruiter view logging (only when a recruiter views, once per recruiter per day, recorded by the server on profile read, kept 90 days), Pro weekly view-count notice (Mondays 09:00), 90-day old-username redirect
- [ ] Frontend 1st pass: guests tapping follow/message/more → login-prompt sheet, header and badges (looking for team, job seeking, "제안 받는 중" (Open to offers) for recruiters only), optimistic follow, followers sheet, completion record, contribution calendar, `generateMetadata` + `opengraph-image.tsx` (developer profiles only; recruiters get the default, blueprint 8-3)
- [ ] Frontend 2nd pass: project post list, pin sheet, teams, message button
- [ ] Frontend (after 31): recruiter profile layout and my page (offer status summary + latest 3 → 33)
- [ ] Server `[Included]`: URL check (https; allowed job sites in server config, else `company_email_domain` and its subdomains; reject short URLs and IPs), daily 00:00 closing batch + notification, ENDED on subscription expiry (called by 29's scheduler)
- [ ] Frontend `[Included]`: my-page job ad card (status, switch, edit), register/edit sheet (job category chips, title, URL, closing date, card preview), Scout prompt → 28 when not subscribed, share button (00 share sheet)

</details>

### P05. 프로필 수정 `[Required]` · `/settings/profile`

**핵심 산출물:** 프로필·태그·구직 상태·GitHub 동기화, 포함 범위의 관심 직군/회사 정보.

**담당:** A · **일정:** D6 morning (0.5 day), recruiter edit and job categories D10 morning · **선행:** 04; recruiter edit 31 · **근거:** A-2, A-3, H-4, H-8

**API 소속:** `AccountController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new 🟡 user_job_categories · shared users, user_tech_tags, tech_tags, recruiter_profiles (after 31)
- [ ] Server: turn off looking-for-team after 30 days inactive, job-seeking status OFF after 90 days inactive + notify on next visit (same scheduler)
- [ ] Frontend: character count validation (react-hook-form + zod), reuse 02's tech stack sheet and job-seeking status component

</details>

### P06. 설정 `[Required]` · `/settings`

**핵심 산출물:** 알림·이메일·차단·탈퇴·로그아웃, 계정 종류별 구독/비밀번호 연결.

**담당:** A · **일정:** Logout D1, rest D4 afternoon (0.5 day), recruiter section included in 32 (D9) · **선행:** 01 · **근거:** POL-A, POL-N-1

**API 소속:** `AccountController`, `NotificationController`, `AuthController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: block list / unblock (ModerationController), owner transfer / team delete (09)
- Tables: new none · shared users, user_agreements, user_blocks, user_sessions, team_members, subscriptions (after 28)
- [ ] Server: scheduler that deletes 30 days after pending withdrawal (posts and comments deleted; team chat shows "탈퇴한 사용자" (Withdrawn user))
- [ ] Frontend: sections, "푸시 알림" (Push notifications) switch (in a browser, note that push is Android-app only), withdrawal sheet steps, hide GitHub items for recruiters and show Scout subscription & billing → 29

</details>

### P07. 워크스페이스·내 이슈 `[Required]` · `/workspace` · `/workspace/issues`

**핵심 산출물:** 팀 목록·전환·빈 상태, 선택한 팀의 내 이슈와 기본 선택·복귀 동작.

**담당:** B (my issues: C) · **일정:** D3 morning (0.5 day), my issues D9 afternoon (C) · **선행:** 01 · **근거:** T-1, I-5

**API 소속:** `TeamController`, `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared teams, team_members, issues, issue_assignees
- [ ] Frontend: team cards, empty state ("팀 만들기" (Create team) + "팀 찾으러 가기" (Find a team)), team switcher sheet (header of 11–15), 10-team limit notice
- [ ] Frontend `[Included]` (C): my-issues team picker; default = max `joinedAt` (non-archived preferred); URL `teamId` (nuqs); list scoped to the selected team
- Frontend handoff (PR #35): B's “내 이슈 전체 보기” links to C's `/workspace/issues`; the list's back fallback is `/workspace`. Both URLs belong to page 07; no additional controller or endpoint is introduced.

</details>

### P08. 팀 생성 `[Required]` · `/teams/new` · `/teams/new/callback`

**핵심 산출물:** App 설치/반환 검증→팀/오너/채팅방→저장소/보드→초기 동기화.

**담당:** B · **일정:** D3 afternoon–D4 (1.5 days) · **선행:** 07, 00 spike · **근거:** T-1, T-3, POL-T-1, POL-I-1

**API 소속:** `GithubController`, `TeamController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new github_installations, github_repos, teams, team_members, team_repos, team_project_boards, board_status_mappings, chat_rooms, chat_room_members · shared github_tokens, github_webhook_deliveries
- [ ] Server: handlers (consumers of the 00 webhook queue) for `installation` webhook (app removed → read-only, archived after 30 days) and `organization` webhook (member sync)
- [ ] Frontend: 5-step flow, 3 callback screen states, "조직이 없어요" (No organization) guide, completion screen (invite → 09, recruit post → 20)

</details>

### P09. 팀 설정·멤버 `[Required]` · `/teams/[id]/settings`

**핵심 산출물:** 팀 권한·멤버·초대 링크/알림·오너 이전·완주·보관/삭제.

**담당:** B · **일정:** 1st pass D5 morning (0.5 day), 2nd pass D6–D7 morning (1.5 days) · **선행:** 08 · **근거:** T-2, T-3, T-4

**API 소속:** `TeamController`, `GithubController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: board change `[Included]` → 08's `setup/boards`, `setup/board`. Team plan → 28
- Tables: new team_invite_links, github_org_invitations, team_completions, completion_records, team_ownership_transfers · shared teams, team_members, team_repos, github_repos, team_project_boards, board_status_mappings, chat_room_members, notifications, subscriptions (after 28)
- [ ] Server: completion record calculation (14+ days membership, confirmed after 7 days), auto-remove from team when removed from org + notify, removed members can't apply for 7 days, member limit (`PlanLimits`)
- [ ] Frontend: sections, hide/disable per permission table, invite sharing (Web Share API, copy), notify Linker developer (@handle) → `TEAM_INVITE` notification with `/invite/[code]`, confirm sheets, read-only team notice
- [ ] Server: on notify-Linker-developer, `NotificationService.create()` type `TEAM_INVITE`, `link_path` `/invite/{code}` (borrowed list read by 18)

</details>

### P10. 초대 수락 `[Required]` · `/invite/[code]`

**핵심 산출물:** 외부/인앱 초대의 동일 랜딩, 로그인 복귀·수락·오류 처리.

**담당:** B · **일정:** D5 afternoon (0.5 day) · **선행:** 09 · **근거:** T-2

**API 소속:** `TeamController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared team_invite_links, teams, team_members, chat_room_members, notifications (created from 09 for in-app invites)
- [ ] Frontend: slim landing — Linker logo, "팀에 합류하기", "GitHub로 빠르게 시작하기". **External** open of this URL always lands here; **in-app** `TEAM_INVITE` from 18 also opens this URL. Guest join/GitHub start → login → onboarding → `returnTo` this URL. Accept failures → toast / one-line error (no status pages). Success → 11. Static title "팀 초대", default OG, `noindex` (blueprint 8-3)

</details>

### P11. 이슈 목록 `[Required]` · `/teams/[id]/issues`

**핵심 산출물:** 이슈 목록·필터·미지정·동기화·보드 편입, Flex 진행 현황.

**담당:** C · **일정:** D3–D4 morning (1.5 days) · **선행:** 08 · **근거:** I-2, I-3, T-7, S-9

**API 소속:** `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new issues, issue_assignees, issue_labels, 🟡 team_progress_snapshots · shared teams, team_repos, github_repos, board_status_mappings, github_webhook_deliveries, subscriptions (after 28)
- [ ] Server: first full sync with installation token, `issues` and `projects_v2_item` webhook handlers, sync every 15 min for active teams / daily otherwise, later value wins
- [ ] Server: daily 00:00 per-team progress snapshot batch (all teams, kept 1 year). Start it on D4 so data accumulates by D10
- [ ] Frontend: team layout (tabs + team switcher + team chat shortcut, shared by 11–15), issue row, filter sheet (nuqs, reused by 14 and 15), conditions for showing the create-issue button
- [ ] Frontend `[Included]` (C, D10): progress card (completion ring, 4-column bars, 14-day trend, per assignee; summary sentence + "표로 보기", blueprint ch. 6), Flex prompt for free teams

</details>

### P12. 이슈 상세 `[Required]` · `/teams/[id]/issues/[issueId]`

**핵심 산출물:** 이슈 본문·담당자·라벨·일정·상태·하위 이슈와 채팅 공유.

**담당:** C · **일정:** D4 afternoon–D5 (1.5 days) · **선행:** 11 · **근거:** I-2, I-3, C-2

**API 소속:** `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: "채팅에 공유" (Share to chat) `[Included]` → 17's send message (issue card type)
- Tables: new issue_sync_jobs · shared issues, issue_assignees, issue_labels, team_members, notifications
- [ ] Server: retry via `issue_sync_jobs` when applying to GitHub fails; show in response when `sync_status = FAILED`
- C12 implementation and isolated verification: [c-page12-implementation.md](plans/c-page12-implementation.md). Detail edits also use `SET_ASSIGNEES`/`SET_LABELS` retry steps; real A/B integration and versioned migration remain separate.
- [ ] Frontend: 4 sheets (assignee, label, date, status) as shared components (reused in 13, 14, 15), disabled + toast without write permission, "일정이 GitHub에 반영되지 않았어요" (Schedule not applied to GitHub)

</details>

### P13. 이슈 생성 `[Required]` · `/teams/[id]/issues/new`

**핵심 산출물:** 템플릿/양식·생성·동기화 작업 상태, AI 액션에서 작성 연결.

**담당:** C · **일정:** D6–D7 (2 days) · **선행:** 12 · **근거:** I-1, POL-I-1

**API 소속:** `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: 12's assignee and label option APIs, 11's `issue-filters` (repo list)
- Tables: new none · shared issues, issue_assignees, issue_labels, issue_sync_jobs, team_repos, team_project_boards, github_tokens
- [ ] Server: parse issue form YAML, form answers → GitHub body (`### Question`, empty `_No response_`), retry queue for mid-way failures, never create Linker-only issues
- [ ] Frontend: stepped (repo & template → content), dynamic form field rendering (react-hook-form + zod), reuse 12's sheets, on failure save draft on device + resend, enter with body prefilled from 17 "이슈로 만들기" (Make an issue)

</details>

### P14. 상태 보드 `[Required]` · `/teams/[id]/board`

**핵심 산출물:** 같은 이슈 데이터의 상태별 조회와 기존 변경 API 재사용.

**담당:** C · **일정:** D8 (1 day) · **선행:** 12 · **근거:** I-4

**API 소속:** `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: status change → 12's `PUT .../issues/{issueId}/status`, filter options → 11's `issue-filters`
- Tables: new none · shared issues, board_status_mappings, issue_sync_jobs
- [ ] Frontend: dnd-kit drag (long-press drag on mobile), optimistic move, revert to original column + notice on failure, horizontally scrolling columns, no drag without write permission

</details>

### P15. 캘린더 `[Required]` · `/teams/[id]/calendar`

**핵심 산출물:** 기간별 일정·담당자 필터와 이슈 일정 API 재사용.

**담당:** C · **일정:** D9 morning (0.5 day) · **선행:** 12 · **근거:** I-4, N-1

**API 소속:** `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared issues, issue_assignees, notifications
- [ ] Server: 9 AM scheduler notifying assignees the day before the due date
- [ ] Frontend: month/week views, range bars and dots, tap a date → that day's issues sheet → 12, guide for issues without due dates

</details>

### P16. 채팅 목록 `[Required]` · `/chats`

**핵심 산출물:** 팀/개인/요청 탭·목록·배지·실시간 갱신·요청 수락/거절.

**담당:** D · **일정:** D3 morning (0.5 day) · **선행:** 08 · **근거:** C-1, C-4

**API 소속:** `ChatController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- STOMP: subscribe server → `/user/queue/chat-rooms` (list updates)
- Tables: new none · shared chat_rooms, chat_room_members, user_blocks, recruiter_profiles (after 31)
- [ ] Frontend: 3 tabs, room row, live updates, requests tab, `[Included]` "채용 제안" (Recruiting offer) label + company name (after 31), empty state

</details>

### P17. 채팅방 `[Required]` · `/chats/[roomId]`

**핵심 산출물:** 메시지·사진·읽음·메뉴·멘션·이슈/PR·개인 요청, 단계별 AI/공유.

**담당:** D (PR posting: B, AI summary: C) · **일정:** Team chat D3 afternoon–D5 (2.5 days), 1:1 & recruiting offers D7 (1 day), PR posting D7 afternoon (B), `[Included]` AI summary D10 morning (C, 0.5 day + Ollama setup by B on D9), `[Included]` share sheet, share cards, link cards D10 afternoon (D, server and screens) · **선행:** 16, 12, 28 · **근거:** C-1, C-2, C-3, C-4, C-5, C-7, P-7, S-6, S-8, H-3

**API 소속:** `ChatController`, `GithubController`, `IssueController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: photo upload (00), message report (ModerationController, copy 10 before/after), accept/delete request (16), "이슈로 만들기" (Make an issue) → 13
- Tables: new chat_messages, chat_message_images, pull_requests, chat_message_mentions, report_message_snapshots, 🟡 ai_chat_summaries (after 28) · shared chat_rooms, chat_room_members, uploaded_files, issues, follows, team_members, user_blocks, report_cases, reports, notifications, subscriptions (after 28), recruiter_profiles (after 31)
- [ ] Server (D): new message notifications (grouped per room), mention notifications (even when muted), @all only for owner/admin, don't deliver messages from blocked users; keep blocked-period DMs invisible after unblocking using retained `user_blocks` intervals (history, catch-up, previews, unread counts, search and notifications; team chat exempt), expire requests after 30 days
- [ ] Server (B): `pull_request` webhook → system messages (undeletable) only for opened, review requested, merged, closed
- [ ] Server (C, reviewed by D): `LlmClient` interface + Ollama implementation (JSON-format response, max 500 messages, excluding deleted, hidden, images and blocked users), 7-day retention batch. B runs Ollama in Docker next to the backend server (D9)
- [ ] Server (D) `[Included]`: share cards and Linker link cards are filled from the original in the message list response (deleted, hidden or blocked → "볼 수 없는 게시물이에요"); post views via a card are logged in 23 with `source = CHAT_SHARE`
- [ ] Frontend (C): AI summary button and range picker, Flex prompt sheet for free teams, summary sheet (jump to original message, N/10), share to chat, action item → 13, "이 팀은 AI 요약을 사용해요" (This team uses AI summary) banner
- [ ] Frontend: STOMP reconnect, TanStack Virtual list, sending/failed/retry, photo viewer, message menu sheet, room info sheet, PR sheet, mentions and #issue cards, request status bar (sender and receiver sides), sender card for recruiting offers

</details>

### P18. 알림 `[Required]` · `/notifications`

**핵심 산출물:** 목록·읽음·배지·푸시 토큰, TEAM_INVITE의 초대 랜딩과 이의 제기.

**담당:** D · **일정:** D6 (1 day) · **선행:** 12, 17 · **근거:** N-1, POL-N-1

**API 소속:** `NotificationController`, `ModerationController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new push_tokens · shared notifications, users, appeals (after 25 — A creates the table in 25; the appeal API is wired on D7)
- [ ] Server: non-chat notifications between 10 PM and 8 AM batched and sent in the morning, Expo push sending (Android; skipped while `push_enabled` is off)
- [ ] Frontend: list (incl. `TEAM_INVITE` → `/invite/[code]`), navigation, read state, live bell badge, appeal sheet, push permission prompt (Android app; iOS out of MVP)

</details>

### P19. 모집 목록 `[Required]` · `/recruits`

**핵심 산출물:** 공개 모집 검색·필터, 내 모집/지원·취소.

**담당:** E · **일정:** D3 (1 day) · **선행:** 04 · **근거:** R-2, R-3

**API 소속:** `RecruitmentController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new recruit_posts, recruit_roles, recruit_post_tags · shared tech_tags, user_blocks, applications (after 21)
- [ ] Frontend: 3 tabs (guests see only the All tab; "모집 글 쓰기" (Write recruit post) → login prompt), card (remaining headcount per role, D-day), filter sheet (nuqs), infinite scroll, empty-result copy

</details>

### P20. 모집 작성·수정 `[Required]` · `/recruits/new` · `/recruits/[id]/edit`

**핵심 산출물:** 모집 직군·정원·조건·내용 작성/수정·마감/재개·삭제.

**담당:** E · **일정:** D4 (1 day) · **선행:** 19 · **근거:** R-1, S-5

**API 소속:** `RecruitmentController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared recruit_posts, recruit_roles, recruit_post_tags, teams, team_members, subscriptions (after 28)
- [ ] Server: scheduler that auto-closes when deadline passes or headcount is full
- [ ] Frontend: form (repeating headcount per role, region required if offline), limit notice sheet, draft restore

</details>

### P21. 모집 상세·지원 관리 `[Required]` · `/recruits/[id]`

**핵심 산출물:** 공개 상세·지원·지원자 조회/수락/거절과 팀/채팅 가입 연계.

**담당:** E · **일정:** D5–D6 morning (1.5 days) · **선행:** 20, 08, 17 · **근거:** R-3, R-4, P-7

**API 소속:** `RecruitmentController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: GitHub org invite → 09's `members/{userId}/github-invitation`, cancel application → 19, close/delete → 20, report → 00
- Tables: new applications · shared recruit_posts, recruit_roles, users, user_tech_tags, contribution_days, completion_records, posts (after 22), team_members, chat_room_members, github_org_invitations, notifications, reports
- [ ] Server: application-received notification, auto-expire after 14 days unhandled, `[Included]` reminder if org invite not accepted 7 days after acceptance, `[Included]` mark as fake recruiting if team deleted within 7 days after acceptance
- [ ] Frontend: screens for guest / applicant / author (guest "지원하기" (Apply) → login prompt), apply sheet, applicants tab and application sheet, 3 acceptance-exception sheets (team member limit shows a Flex prompt), reject sheet, `[Included]` share button (00 share sheet), `generateMetadata` + `opengraph-image.tsx` (title, remaining roles, D-n, blueprint 8-3)

</details>

### P22. 작업물 작성·수정 `[Required]` · `/posts/new` · `/posts/[id]/edit`

**핵심 산출물:** 공개 저장소·사진·역할·문제/해결·데모 작성/편집·초안/실패 복구.

**담당:** E · **일정:** D6 afternoon–D7 (1.5 days) · **선행:** 04 · **근거:** P-1, P-2

**API 소속:** `PostController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: photo upload (00), tech tags (00), limit notice → 28
- Tables: new posts, post_images, post_demo_links, post_tags · shared github_repos, uploaded_files, tech_tags, issues, team_members, subscriptions (after 28)
- [ ] Frontend: stepped (repo → content), reorder photos and retry partial failures, optional fields, email registration guide when commits are 0, draft restore

</details>

### P23. 작업물 상세 `[Required]` · `/posts/[id]`

**핵심 산출물:** 공개 상세·README·좋아요·댓글·삭제 권한·같은 저장소 글·공유.

**담당:** E · **일정:** D8 (1 day) · **선행:** 22 · **근거:** P-3, P-5, P-7, S-4

**API 소속:** `PostController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: report (00), "채용 제안 보내기" (Send recruiting offer) → 17's `POST /api/v1/recruiter/chat-requests`, edit → 22
- Tables: new post_likes, comments, 🟡 post_views · shared posts, post_images, github_repos, users, notifications, reports, user_blocks
- [ ] Frontend: photo swipe and viewer, README toggle, guests tapping like / comment input / more → login prompt, optimistic like, comments and replies, more sheet, for recruiters hide input + offer menu (after 31), `[Included]` share button (00 share sheet), `generateMetadata` + OG image (cover photo, otherwise `opengraph-image.tsx` repo card; strip `?from=share` from canonical, blueprint 8-3)

</details>

### P24. 홈 피드 `[Required]` · `/feed`

**핵심 산출물:** 공개/회원 피드·추천·열람 제외, 포함 광고의 클릭/닫기/숨기기/신고.

**담당:** E · **일정:** D9 (1 day), job ad card D10 morning · **선행:** 23; job ad needs the 04 job ad sheet · **근거:** P-4, H-9

**API 소속:** `PostController`, `RecruiterAdController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: follow → 04, like → 23, ad report → ModerationController (target RECRUITER_AD)
- Tables: new feed_seen_posts, 🟡 ad_hides, 🟡 ad_daily_stats · shared posts, post_likes, comments, follows, users, user_tech_tags, post_tags, user_blocks, user_job_categories, recruiter_ads, subscriptions
- [ ] Server `[Included]`: mix `type: "AD"` items into the feed response (only for logged-in developers with matching job categories, 1 per 10 posts, not on the first screen, 3 per person per day and same ad once per day via Redis), exclude closed within 7 days / hidden / block relations, impression/click Redis counters → `ad_daily_stats` once a day
- [ ] Server: popularity score (like 1, comment by others 2, time decay, ignore likes from accounts under 7 days old), "why shown" priority, `[Included]` 2nd-degree recommendations
- [ ] Frontend `[Included]`: ad card ("광고" (Ad) label, company, title, job category, closing date, X, more → hide/report), close undo toast, tap → click API → external link sheet
- [ ] Frontend: card (job-seeking badge), infinite + virtual scroll, write button (none for recruiters, login prompt for guests), guests don't send `seen`, empty feed, `[Included]` recruiter toggle (nuqs)

</details>

### P25. 운영 신고 관리 `[Required]` · `/admin/reports`

**핵심 산출물:** 운영 신고 목록·증거·조치·재심·OTP·감사 기록.

**담당:** A · **일정:** D6 afternoon–D7 morning (1 day) · **선행:** 00, 23 · **근거:** O-1, O-2, O-4

**API 소속:** `AdminController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new sanctions, admin_actions, appeals (18's appeal API is wired on D7) · shared report_cases, reports, report_message_snapshots, posts, comments, recruit_posts, chat_messages, users, admins, notifications, recruiter_ads (after D10)
- [ ] Server `[Included]`: job ad report detail (company, title, job category, closing date, URL host); hide action = `recruiter_ads.status = HIDDEN` + notify the recruiter
- [ ] Server: log every action to `admin_actions` (27), 5 dismissed reports in 30 days → no reporting for 30 days, log out after 30 min idle
- [ ] Frontend: desktop layout (list + right detail panel, shared by 26 and 27), filters, action confirm sheet

</details>

### P26. 운영 회원 관리 `[Required]` · `/admin/users`

**핵심 산출물:** 회원 검색·제재/해제·사유 있는 이메일 열람, 결제/광고 서비스 연계.

**담당:** B · **일정:** D8 (1 day) · **선행:** 25 · **근거:** O-3

**API 소속:** `AdminController`, `SubscriptionController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared users, sanctions, banned_github_ids, report_cases, admin_actions, subscriptions, payments (after 28), recruiter_profiles (after 31), recruiter_ads (after D10)
- [ ] Server: allowed actions while suspended (login, view, appeal, withdraw), reset step after 1 year without violations, permanent ban → `banned_github_ids`, `[Included]` suspending a recruiter hides their job ad immediately (HIDDEN; stays hidden after the suspension ends until an operator lifts it, 04 policy ch. 3 "Job ads")
- [ ] Frontend: reuse 25's layout, sanction sheet, lift confirmation

</details>

### P27. 운영 감사 로그 `[Required]` · `/admin/audit`

**핵심 산출물:** 운영자·행위·기간 필터와 수정 불가 감사 기록.

**담당:** B · **일정:** D9 morning (0.5 day) · **선행:** 25, 26 · **근거:** O-5

**API 소속:** `AdminController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared admin_actions, admins
- [ ] Server: `admin_actions` is append-only (no update/delete API; DB grants INSERT and SELECT only)
- [ ] Frontend: filters + table

</details>

### P28. 요금제·결제 `[Required]` · `/subscribe` · `/subscribe/success` · `/subscribe/fail`

**핵심 산출물:** 개인화 요금제·Flex 팀·Toss 테스트 결제·성공/실패, 공유 캐시 금지.

**담당:** D · **일정:** D8–D9 morning (1.5 days), Scout D10 morning · **선행:** 04, 09, 17, 20, 22 · **근거:** S-1, S-3, S-7, H-5

**API 소속:** `SubscriptionController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new subscriptions, payments · shared users, teams, team_members, notifications
- [ ] Server: compare amount with server order value, `[Included]` 7-day free trial + reminder the day before, `[Included]` billing key (first version: one-time payment + expiry date)
- [ ] Frontend: plan comparison, Toss payment widget (test key, "실제로 돈이 나가지 않아요" — no real money is charged), success screen (unlocked benefits), failure screen

</details>

### P29. 구독 관리 `[Required]` · `/settings/subscription`

**핵심 산출물:** 구독/결제 내역·해지/환불·담당자 이전·만료/유예/알림.

**담당:** D · **일정:** D9 afternoon (0.5 day) · **선행:** 28 · **근거:** S-2

**API 소속:** `SubscriptionController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared subscriptions, payments, recruiter_ads (after 04 job ad)
- [ ] Server: expiry → free scheduler (existing content stays; free limits apply to new writes; when Scout ends the job ad becomes ENDED and offers drop to 10), `[Included]` 7-day grace after payment failure
- [ ] Server: Flex 30-day grace after it ends (`grace_ends_at`) and notices, compute `seats` and amount from the billing-date headcount, day-before headcount/amount notice
- [ ] Frontend: current plan, history, cancel/refund confirm sheets

</details>

### P30. 내 통계 `[Included]` · `/me/stats`

**핵심 산출물:** 무료/Pro 통계·유입·추이·채용 담당자 조회 수, 표 보기/대표 고정 연결.

**담당:** B · **일정:** D9 afternoon (0.5 day) · **선행:** 04, 23, 28 · **근거:** S-4, S-10

**API 소속:** `StatsController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared profile_visits, post_views, posts, post_likes, comments, subscriptions
- [ ] Frontend: free area + blurred Pro area ("Pro로 보기" (View with Pro) → 28), traffic source bars and 30-day trend chart (summary sentence + "표로 보기"), "대표 작업물로 고정" (pin as featured) shortcut

</details>

### P31. 채용 담당자 가입 `[Included]` · `/recruiter/signup`

**핵심 산출물:** 회사 이메일 검증·동의·계정/회사 가입, 코드·재전송·실패 정책.

**담당:** A · **일정:** D7 afternoon–D8 morning (1 day) · **선행:** 03, 04, 06 · **근거:** H-1, POL-H-1

**API 소속:** `AuthController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: `recruiter-terms` document (03)
- Tables: new 🟡 recruiter_profiles, 🟡 email_verifications · shared users (user_type, job_seeking_status), auth_identities, user_agreements, user_sessions
- [ ] Server: mail service (shared by codes and reset; Mailpit in dev), free-domain list as config, store code hashes, username `r-` + number, bcrypt, age 19+
- [ ] Server: test that `@DeveloperOnly` is on every developer-only API (call all write APIs with a recruiter account → 403)
- [ ] Frontend: stepped (terms → email verification → account & company), resend countdown, done → `/feed` (2 bottom tabs)

</details>

### P32. 채용 담당자 로그인·비밀번호 `[Included]` · `/recruiter/login` · `/recruiter/reset`

**핵심 산출물:** 로그인·잠금·재설정 요청/유효성/변경과 다른 세션 종료.

**담당:** A · **일정:** D9 morning (0.5 day) · **선행:** 31 · **근거:** H-1

**API 소속:** `AuthController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Borrowed: password change is 06's `PATCH /api/v1/recruiter/me/password`
- Tables: new none · shared auth_identities, email_verifications, user_sessions, users, recruiter_profiles, user_blocks
- [ ] Frontend: login form and lock notice, forgot password, reset screen, 06's recruiter section

</details>

### P33. 보낸 채용 제안 `[Included]` · `/recruiter/offers`

**핵심 산출물:** 대화 중/대기/미응답·요약·첫 메시지. 거절 사실은 발신자에게 숨김.

**담당:** A · **일정:** D9 afternoon (0.5 day) · **선행:** 31, 17 · **근거:** H-3

**API 소속:** `ChatController`

<details>
<summary>원본 세부 작업·재사용 API·신규/공유 테이블</summary>

- Tables: new none · shared chat_rooms (request_kind = RECRUITING), chat_messages, users, user_tech_tags, user_blocks
- [ ] Frontend: tabs (nuqs), row (first 3 stack tags, job-seeking badge, first message one line), "대화 열기" (Open chat) → 17 when in conversation, "볼 수 없는 사용자" (Unavailable user) for blocked/withdrawn, empty state

</details>

## 6. 통합 완료 기준과 지연 대응

| 시점 | 기존 통합 흐름 |
| --- | --- |
| D2 | WebView 로그인·설치 복귀·Projects 필드·웹훅·STOMP·Toss 기술 확인 + 프론트 기반 |
| D5 | 로그인→온보딩→팀 생성→이슈 목록/상세→팀 채팅 |
| D7 | 이슈 담당 알림, 모집→지원→수락→팀/채팅 가입→완주 |
| D8 | 작업물→댓글/좋아요→개인 대화, Pro 결제 |
| D9 | 피드, 신고→숨김→감사, 결제→취소, 가입→채용 제안→보낸 목록 |
| D10 | 기존 TODO 전체 데모, 모바일 브라우저·WebView·Included 연결 |

이 표는 기존 계획의 시점이며 완료 사실이 아니다. 실제 출시 조건은 MVP 문서가 우선한다. Included이면서 데모 조건에도 등장하는 Scout 광고·채용 담당자 등은 생략 여부를 팀이 결정한다.

| 위험 | 대응 |
| --- | --- |
| App 설치·Projects 제약 | 새 보드 우선, Blocked 별도 필드 등 기존 대안 |
| 팀 채팅 D5 지연 | 사진·미확인 인원 UI를 D7로 조정하고 수락의 채팅 참여 계약 먼저 연결 |
| Toss 연계 문제 | 기존 단건 결제+만료 대안 우선 검토. 체험·자동 갱신 범위 변경은 합의 |
| 공통 파일 충돌·로직 중복 | 시스템 주담당 검토, 공통 서비스 재사용, API 소유 중복 금지 |
| 일정 지연 | Included 순서 조정. 필수 기능·출시 조건 변경은 별도 합의 |

기존 Included 후순위 순서: **광고 → 30 통계 → 공유 시트/카드·링크 카드 → 11 진행 현황 → 17 AI → 31~33 → 기존 보드 선택 → 운영 OTP → 피드 2차 관계 추천 → 기여 그래프**. 개발자 구직 상태는 유지한다.

## 7. 적용·이행 범위

- 문서 기준은 **업무 시스템 18개·역할별 HTTP 컨트롤러 29개·205개 REST·5개 실시간 경로·69개 기존 테이블**이다. 현재 기반 코드는 계층 정리를 반영했지만 전체 18개 시스템·29개 HTTP 컨트롤러가 구현된 상태는 아니다.
- 페이지 담당·메서드 구현자는 1·4·5장을 따른다. 공유 파일의 기본 검토자는 시스템 주담당이다.
- 기존 클래스는 점진적으로 통합한다. URL·DTO·OpenAPI 태그·권한·STOMP·DB를 유지하고 진행 중인 인증·업로드·신고·알림 작업을 보존한다.
- Java 배치와 현재 구현/목표의 차이는 [백엔드 Blueprint](05-backend-blueprint.md)가 소유한다. 페이지별 컨트롤러 규칙은 시스템별 규칙으로 대체됐다.
- 이메일·AI·저장소 업체, BFF, 세션 세부, 미확정 보존 기간은 이번 구조 재편으로 결정하지 않는다. 원본 작업의 특정 업체/배포 가정은 현재 적용 사실이나 신규 승인으로 해석하지 않는다.
- 외부에서 관리하는 한국어 원본에도 시스템별 컨트롤러·담당·총계 변경을 반영해야 한다.

**반영 범위:** WBS 교체와 백엔드 Blueprint·안내 문서 정합성, 기존 기반 Java 코드의 계층 이동·컨트롤러 통합. SQL·실제 DB·배포 설정은 변경하지 않는다.

### 전환 기준

2026-11-03의 기존 WBS를 바탕으로 전환했다. 당시 HEAD는 2e68ad3, 원본 WBS의 SHA-256 앞 12자리는 6958b102b891이다. 원본의 205개 REST는 페이지·메서드·경로·동작·권한을 유지했다. 이후 변경은 이 공식 WBS에서 관리한다.
