# 00 공통 기반 (D1–D2) — A~E 조율 체크리스트

> 알림 생성 계약(2026-11-04): 아래 NotificationService 표기는 현재 `UserNotificationService` / `RecruiterNotificationService` / `AdminNotificationService`의 `create(CreateNotificationCommand)`로 대체한다. DTO는 dto.notification.request, 서비스는 service의 해당 역할 폴더다. 수신자 종류와 생성 서비스 역할은 별개이며 기존 DB·알림 정책을 유지한다.

> 근거: [02 WBS ch. 3](02-wbs.md), [03 frontend blueprint §1-1](03-frontend-blueprint.md#1-1-foundation-built-before-pages-the-most-important-work), [07 page-todo 00](../planning/07-page-todo.md)  
> 원칙: **계약을 먼저 연 쪽에 맞춘다.** 페이지 작업은 D2 체크·6 스파이크 통과 후.

---

## 0. 맞추는 방향 (Source of truth)

| 주제 | 기준 | 맞추는 쪽 |
| --- | --- | --- |
| 모노레포 / `api-fetch` / orval / Providers | **E** | A B C D |
| 로그인·JWT claim·`proxy`·역할 라우트 | **A** | B(앱 복귀), 전 페이지 |
| 시트·뒤로가기·공통 컴포넌트 | **E** | A(로그인 시트 포함), 전 페이지 |
| Policy 숫자·날짜·포맷 | **C `policy.ts` ← Policy** | 전원 |
| 알림 생성 API | **D `NotificationService`** (D2 freeze) | 전 페이지 |
| 신고·차단·업로드 | **E** | 피드·채팅·프로필 등 borrow |
| GitHub App·웹훅·배포 | **B** | C(이벤트 소비), A(로그인 콜백 정렬) |
| Projects / 이슈 원본 스파이크 | **C** | B 08, 이후 11–15 |
| OpenAPI `@Tag` / Sentry | **전원 합의 후 freeze** | 이후 변경은 orval 재생성 비용 고려 |
| 엔드포인트 소유 | **WBS 페이지 오너** | 다른 사람은 borrow만 (복제 API 금지) |

---

> 신고 알림 freeze: E는 최초 자동숨김 시 활성 운영자별 `AdminNotificationService.create`로 `REPORT_AUTO_HIDDEN`을 생성한다(역할 간 호출의 좁은 예외). 피신고자·신고자에게 생성하지 않으며 중복 생산을 막는다. 상세 계약은 [청사진 §4](05-backend-blueprint.md#report-auto-hide-notification--frozen-contract). 호출부 연결은 E 담당이며 이 기록은 연결 완료를 뜻하지 않는다.

## 1. D1 오전 — E가 연 뒤에 시작

- [ ] **E** 모노레포·Next·tokens·`radix-ui` 골격 머지
- [ ] **E** `packages/api`(orval) + `lib/api/api-fetch` + 공통 에러 코드 처리 + `Providers`
- [ ] **A B C D** E의 fetch/orval/Provider 경로만 사용 (각자 `fetch` 금지)
- [x] **전원** OpenAPI `@Tag` ↔ orval 파일 규칙 합의·문서화 — [00 OpenAPI 태그](plans/00-openapi-tags.md)

---

## 2. D1 — 병렬하되 계약만 공유

### A (인증·가드·프레임)
- [ ] 회원/로그인 분리, `user_type`, JWT httpOnly(부모 도메인), GitHub 토큰 암호화
- [ ] JWT claims 표 freeze: `sub`, `typ`, `adm`, `onb`, `st` + 재발급 시점(온보딩 완료·정지·해제·운영자 지정)
- [ ] `@DeveloperOnly`, Security 5역할, 정지 시 쓰기 차단
- [ ] `route-access.ts` / `session.ts` / `proxy.ts` / 6 그룹 `layout` / `PageFrame`·탭·스킵 링크
- [ ] **A → 전원** claim 표·쿠키 속성 슬랙/이슈에 공유

### C (정책·포맷·SEO)
- [ ] `policy.ts` (Policy 숫자만, 페이지 하드코딩 금지)
- [ ] KST 포맷터, `safeStorage` / `useIsClient`
- [ ] SEO helpers + `robots.ts`, `next/image` + sharp
- [ ] **C → 전원** `policy.ts` 키 목록 공유

### E (오버레이)
- [ ] `useOverlay` / `useAppBack` / overlay-keys
- [ ] **전원 → E** 시트·모달은 `useOverlay`만 (페이지 `useState` 시트 금지)

### B (인프라 선행)
- [ ] 호스트·Postgres·Redis·서울 리전 결정 (웹훅·STOMP 스파이크 전)
- [ ] **B → A·D** 접속 정보·환경 변수 키 이름 공유 — A의 1차 확인은 [인프라 접속 기록](plans/00-infra-access-log.md)

---

## 3. D2 — 기능 기반 + 스파이크

### A
- [ ] 로그인 유도 시트 + `useRequireLogin` + `returnTo`
- [ ] API `401 LOGIN_REQUIRED` → 동일 시트 (E 오버레이 경로 사용)
- [ ] `GET /api/v1/user/me`, refresh, public optional-auth·게스트 IP 제한

### E
- [ ] 공통 UI: sheet, confirm, toast, empty, skeleton, `error.tsx`, `not-found.tsx`
- [ ] 공통 시트: 신고, 차단, 외부링크, 삭제확인, 한도, 초안복구
- [ ] 업로드 API + 업로더 UI
- [x] 신고·차단 규칙 + `user_blocks` 기간 모델 (삭제가 아니라 기간 닫기)
- [x] **E → D** 차단 스키마·“활성 기간” 의미 freeze (DM은 기간 전체 소비) → `plans/e-block-contract-freeze.md`

### B
- [ ] GitHub App 등록 (PRD ch.8 + Email read), 웹훅 서명·큐, smee
- [ ] 스파이크: 설치 → Setup URL 복귀 → `GET /user/installations` 검증
- [ ] bridge + Expo WebView (`linker://auth`, Android back)
- [ ] **B ↔ A** 웹 로그인 콜백과 앱 딥링크 복귀 시나리오 한 장으로 맞춤 (JWT 브릿지 금지) — 코드 대조는 [00 스파이크](plans/00-foundation-spikes.md) §5. 로그아웃 문구는 열림

### C
- [ ] 스파이크: Projects 보드, Status Blocked, start/due 필드, `projects_v2_item` 웹훅 — 조회 결론만 [00 스파이크](plans/00-foundation-spikes.md) §1
- [ ] Vitest + axe, Playwright + axe, MSW 골격
- [ ] **C ↔ B** 웹훅 이벤트 목록·페이로드 필드 freeze — 큐 값 설명은 같은 문서 §2. 수신 샘플 전이라 공동 freeze는 아님

### D
- [ ] STOMP 설정·인증 인터셉터·재연결 — 브라우저 확인은 못 함. [00 스파이크](plans/00-foundation-spikes.md) §3
- [ ] `NotificationService.create()` **시그니처 D2 freeze**
- [ ] Redis `@RateLimit`, `PlanLimits` (숫자는 Policy / `policy.ts`와 동일 출처)
- [ ] 스파이크: Toss 테스트 결제 → confirm → cancel — 키 없음. [00 스파이크](plans/00-foundation-spikes.md) §4
- [ ] 프론트 `lib/realtime` STOMP 클라이언트
- [ ] **D → 전원** 알림 create 인자·에러 코드 공유 (이후 시그니처 변경 자제) — [공유 안내·담당별 확인 양식](plans/d-notification-create-contract.md) 작성 완료. 실제 전달·이슈 고정·소비자 확인은 별도.

---

## 4. 쌍방 조율 체크 (누가 누구에게)

### E ← 전원
- [ ] API 호출은 `api-fetch` / orval만
- [ ] 시트는 `useOverlay`만
- [ ] mock은 `mocks/pages/pNN-*`, 페이지 코드에서 mock 직접 참조 금지

### A ← B·페이지
- [ ] 역할·온보딩·정지 분기는 A claim/`route-access` 따름
- [ ] 앱 복귀는 A 세션 쿠키 전제, B는 브릿지·딥링크만

### A ← D
- [ ] STOMP 연결 주체는 로그인 세션(A); D가 별도 토큰 체계 만들지 않음

### C ← 전원
- [ ] 제한 숫자·플랜 한도·날짜 표시는 `policy.ts` / format만

### E ← D (차단)
- [ ] unblock = 기간 종료; D는 히스토리 기간으로 DM 필터

### D ← 전 페이지 (알림)
- [ ] 알림은 `NotificationService.create()`만; 페이지별 알림 테이블 금지

### B ← C (GitHub)
- [ ] 인입·서명·큐 = B / 보드·이슈 의미 = C
- [ ] 스파이크 실패 시 합의: 08 보드 “새로 만들기만” 등으로 축소 (WBS ch.6)

### OpenAPI ← mock
- [ ] 실서버 붙일 때 **서버(오너) OpenAPI 필드명에** mock·프론트 맞춤 (반대 방향 금지)

---

## 5. D2 종료 — 인터페이스 freeze 목록

아래를 이슈/스레드에 붙여 두고 “변경 시 전원 멘션”으로 운영합니다.

- [x] JWT claim 필드·의미·재발급 시점 (**A**) — [00 구현 계약 freeze](plans/00-foundation-contract-freeze.md) §1–§2
- [x] 공통 에러 코드 + `api-fetch` 매핑 (**E**; `LOGIN_REQUIRED`↔A) — 같은 문서 §3
- [x] `NotificationService.create()` 인자 (**D**) — 같은 문서 §6
- [x] `user_blocks` 열기/닫기 의미 (**E**; D 소비) — see `plans/e-block-contract-freeze.md`
- [ ] 웹훅 이벤트·큐 페이로드 (**B**; C 소비) — [B 전달 계약·C 확인 대기 항목](plans/b-backend-cross-contracts.md). 작성과 공동 freeze를 구분
- [x] OpenAPI `@Tag` 규칙 (**전원**) — [00 OpenAPI 태그](plans/00-openapi-tags.md)
- [x] `policy.ts` 키 (**C**) — [00 구현 계약 freeze](plans/00-foundation-contract-freeze.md) §5
- [x] Tech tags / job categories public API 형태 (**A**; 시트 소비자는 그대로) — 같은 문서 §4

---

## 6. End-of-D2 통과 체크 (페이지 착수 조건)

### 프론트 foundation (blueprint §1-1)
- [ ] E 스테이지 1 (모노레포·api-fetch) 완료
- [ ] A 가드·프레임 완료
- [ ] E 오버레이 + C policy/SEO 완료
- [ ] A 로그인 시트, E 공통 시트, B bridge, D STOMP, C 테스트 세팅 완료
- [ ] guest `/workspace` → 로그인 시트 → 복귀
- [ ] guest `/admin` → 404
- [ ] 시트 닫기 / 하드웨어 뒤로가기 동작

### 6 스파이크
- [ ] WebView GitHub 로그인 복귀 (**B↔A**)
- [ ] App 설치 콜백 검증 (**B**)
- [ ] Projects Blocked + 날짜 필드 (**C**) — 조회 결론만 [00 스파이크](plans/00-foundation-spikes.md) §1
- [ ] 웹훅 수신 (**B**, C 소비 가능) — smee ping 없음. 같은 문서 §2
- [ ] STOMP 재연결 (**D**) — 브라우저 확인 없음. 같은 문서 §3
- [ ] Toss confirm/cancel (**D**) — 키 없음. 같은 문서 §4

### 공통
- [ ] Sentry 연동 (**전원**)
- [ ] 각자 담당 mock 파일이 WBS 00·자기 페이지 엔드포인트와 동기

---

## 7. 깨지기 쉬운 순서 (하지 말 것)

- [ ] E `api-fetch` 전에 A/C가 각자 fetch 작성
- [ ] A claim 변경을 proxy / 앱(B)에 미공유
- [ ] D3 이후 `NotificationService` 시그니처 조용히 변경
- [ ] E 차단을 물리 삭제로 바꿔 D DM 깨기
- [ ] `policy.ts` 무시하고 페이지에 `3`/`10`/`60` 하드코딩
- [ ] WBS에 없는 API를 페이지마다 복제

---

## 8. 역할별 원페이지 할 일 (복사해서 이슈에)

### E 이슈 체크
- [x] D1 오전 api-fetch/orval/Providers
- [x] overlay + 공통 시트 + 업로더
- [x] 신고/차단 API·필터·기간 모델
- [x] D와 차단 계약 freeze → `docs/development/plans/e-block-contract-freeze.md`, `UserModerationService.hidesDirectMessage`
- [ ] Vercel 배포 파이프 초안

### A 이슈 체크
- [ ] JWT/Security/`/user/me`
- [ ] proxy·route-access·프레임
- [ ] 로그인 시트 + LOGIN_REQUIRED
- [ ] claim 표 공유
- [ ] B와 앱 로그인 복귀 정렬

### B 이슈 체크
- [ ] 인프라 결정·GitHub App·웹훅
- [ ] 설치 콜백 스파이크
- [ ] bridge + Expo 셸
- [ ] C와 웹훅 이벤트 freeze
- [ ] A와 auth 딥링크 정렬 — 페이지 전 경계는 [00 페이지 착수 경계](plans/00-page-gate.md)

### C 이슈 체크
- [ ] policy/format/SEO/image
- [ ] Projects 스파이크
- [ ] 테스트 하네스
- [ ] B와 웹훅 소비 계약
- [ ] policy 키 공유

### D 이슈 체크
- [ ] STOMP + realtime 클라이언트
- [ ] NotificationService freeze
- [ ] RateLimit + PlanLimits
- [ ] Toss 스파이크
- [ ] E 차단 스키마 소비 확인

## D 정책값 대조 (2026-11-05)

D 담당 채팅·알림·구독만 대조했다. 기준은 `docs/planning/04-policy.md`. 서버는 `PlanLimits`, 화면은 `frontend/apps/web/src/lib/policy.ts`. 적힌 숫자가 같으면 값을 바꾸지 않았다. 요금은 Policy 11장에 있고 14장에서 아직 미확정이다.

### 일치

| 항목 | Policy | PlanLimits | policy.ts |
| --- | --- | --- | --- |
| 채팅 전송 | 2장 5회/초 | `CHAT_SENDS_PER_SECOND` 5 | `CHAT.sendsPerSecond` 5 |
| 메시지 길이 | 8장 2,000자 | `CHAT_MESSAGE_MAX_CHARS` 2000 | `CHAT.messageMax` 2000 |
| 사진 수 | 8장 한 번에 10장 | `CHAT_IMAGES_PER_SEND` 10 | `CHAT.imagesPerSend` 10 |
| 수정 가능 시간 | 8장 24시간 | `CHAT_EDIT_WITHIN_HOURS` 24 | `CHAT.editWithinHours` 24 |
| 채용 첫 메시지 | 8장 1,000자 | `CHAT_OFFER_MESSAGE_MAX_CHARS` 1000 | `CHAT.offerMessageMax` 1000 |
| 재접속 한 번에 불러오기 | 8장 예외 500개 | `CHAT_CATCH_UP_MAX` 500 | `CHAT.catchUpMax` 500 |
| 전송 자동 재시도 | 2장 3회 | `CHAT_AUTO_RETRIES` 3 | `CHAT.autoRetries` 3 |
| 무료 팀 대화 조회 | 11장 60일 | `TEAM_CHAT_HISTORY_DAYS_FREE` 60 | `PLAN_LIMITS.teamChatHistoryDays.free` 60 |
| 채용 제안 | 2장·11장 10회/일, Scout 50 | `RECRUITING_OFFERS_PER_DAY_*` 10, 50 | `PLAN_LIMITS.recruitingOffersPerDay` 10, 50 |
| AI 요약 | 2장·11장 10회/일 | `AI_SUMMARY_PER_DAY_FLEX` 10 | `PLAN_LIMITS.aiSummaryPerDay.flex` 10 |
| 조용한 시간 | POL-N-1 22:00–08:00, 마케팅 21:00–08:00 | `QUIET_HOURS_*` 22, 8, `MARKETING_QUIET_HOURS_START_HOUR` 21 | 화면 상수 없음. 서버 값은 Policy와 같음 |
| Pro 월 요금 | 11장 ₩2,900 | `PRO_MONTHLY_KRW` 2900 | `SUBSCRIPTION_PRICE.proMonthly` 2900 |
| Flex | 11장 ₩7,900, 6명까지, 7번째부터 ₩1,900 | `FLEX_BASE_MONTHLY_KRW` 7900, `FLEX_INCLUDED_SEATS` 6, `FLEX_EXTRA_SEAT_KRW` 1900 | `flexMonthly` 7900, `flexExtraMember` 1900, `teamMembers.free` 6 |
| Scout 월 요금 | 11장 ₩14,900 | `SCOUT_MONTHLY_KRW` 14900 | `scoutMonthly` 14900 |
| 체험·환불·Flex 유예 | 7일, 7일, 30일 | `SUBSCRIPTION_TRIAL_DAYS` 7, `PAYMENT_REFUND_WITHIN_DAYS` 7, `FLEX_POST_EXPIRY_GRACE_DAYS` 30 | `trialDays` 7, `refundWithinDays` 7, `flexGraceDays` 30 |

### 숫자 충돌은 없고, 한쪽 또는 양쪽에 상수가 없음

Policy가 숫자를 정했으므로 페이지에서 새로 만들지 않고 여기 값으로 채운다.

| 항목 | Policy | 없는 곳 |
| --- | --- | --- |
| Pro 연 요금 ₩29,000 | 11장 | `PlanLimits`. `policy.ts`의 `proYearly` 29000은 Policy와 같음 |
| 결제 실패 유예 7일 | 11장 | `policy.ts`. `PAYMENT_FAILURE_GRACE_DAYS` 7은 Policy와 같음 |
| 무료 팀 채팅 이미지 원본 90일 | 8장·11장 | `PlanLimits`, `policy.ts` |
| AI 요약 결과 보관 7일 | 11장 | `PlanLimits`, `policy.ts` |
| Flex 종료·유예 종료 7일 전 알림 | 11장 | `PlanLimits`, `policy.ts` |
| 채팅방 공유 10회/분, 100회/일 | 2장 | `PlanLimits`, `policy.ts` |

### 합의 전 상수로 두지 않음

| 항목 | 이유 |
| --- | --- |
| 1:1 채팅 이미지 원본 1년 | 8장 예외와 14장이 잠정이라고 적음 |
| 요금·플랜 이름 최종 확정 | 11장 숫자와 14장 미확정 체크가 같이 있음. 지금 세 곳의 월 요금은 같고, 이 대조에서 금액을 바꾸지 않음 |
| AI 요약 10회가 최종인지 | 2장·11장·양쪽 코드는 10. 8장·14장에 잠정 10으로 명시됨 |

## D STOMP 연결 검증 (2026-11-05)

개발 서버 `127.0.0.1:8080`은 꺼져 있었다. 아래는 그 서버가 아니라, `StompConnectionTest`가 띄운 임베디드 서버에 WebSocket으로 붙인 결과다. Postgres·Redis는 테스트 컨테이너다. 인터셉터 단위 테스트와 구분한다. 인증은 A의 `linker_session` 쿠키만 사용했다.

`./gradlew test --tests com.linker.backend.global.realtime.StompConnectionTest` 5개 통과.

| 시나리오 | 결과 |
| --- | --- |
| 쿠키 없는 `/ws` 핸드셰이크 | 연결 실패 |
| 정지 계정 쿠키 | 연결 실패 |
| 로그인 쿠키로 CONNECT | 연결됨 |
| `/user/queue/notifications`, `/user/queue/chat-rooms` 구독 | 구독 후 연결 유지. 알림이 도착하는지는 보지 않음 |
| 끊었다가 같은 쿠키로 다시 CONNECT하고 개인 큐 재구독 | 연결됨 |
| `/topic/secret` 구독 | 서버가 연결을 끊음 |
| `/topic/chat-rooms/1` 구독 | 연결 유지. `AuthenticatedChatRoomAccess`가 양수 방 번호를 통과시키는 임시 동작 |

### 미검증

- 놓친 메시지 복구와 중복 저장 방지. 채팅 저장이 없다.
- 개인 큐로 알림이 실제로 전달되는지. 구독만 확인했다.
- 팀 공통 DB에 붙은 개발 서버 `8080`. 이번 실행에는 없었다.

## D 차단 적용 지점 (2026-11-05)

메시지 저장은 만들지 않는다. 기준은 `docs/development/plans/e-block-contract-freeze.md`이고, 조회는 이미 있는 `UserModerationService`를 쓴다. 페이지 16·17에서 아래 지점에 연결한다.

### 호출 지점

| 지점 | 호출 |
| --- | --- |
| 1:1 메시지 조회, 재접속으로 가져온 메시지, 목록 미리보기, 안 읽은 수 | `hidesDirectMessage(보는 사람, 보낸 사람, message.createdAt)`가 참이면 그 메시지를 숨긴다 |
| 팀 채팅 목록, 전송, 구독, 안 읽은 수 | 호출하지 않는다 |
| 알림 | `create` 안에서는 차단을 보지 않는다. `create`를 호출하기 직전에 거르고, 숨길 메시지면 `create`를 호출하지 않는다 |
| 방 숨김, 1:1 시작 | 현재 차단만 `blockedEitherWay`. 지난 메시지에는 쓰지 않는다 |

### 입력 시각

메시지 `createdAt`을 넘긴다. 숨기는 기간은 보는 사람이 연 `[created_at, unblocked_at)`이다. `unblocked_at`이 없으면 그 시각 이후를 모두 숨긴다. 차단을 해제해도 그 기간 안의 메시지는 계속 숨긴다.

### 미정

- 알림 억제를 `CHAT`과 `MESSAGE_REQUEST`만 할지, 그 사람이 만든 다른 종류도 할지.
- 알림 판단에 넘길 시각이 메시지 `createdAt`인지.
- 피드·프로필·게시물의 활성 차단은 E가 따로 빌린다. 이 적용 계획에 넣지 않는다.


## D 정책 상수 보완 (2026-11-05)

앞의 누락 표는 대조 당시 기록이다. 아래 서버 상수를 보완했다. 프론트 변경·C 확인은 아직 별도이며, 최종 계약 완료로 표시하지 않는다. 요금·플랜명·AI 일일 한도·1:1 이미지 보관 기간의 잠정 상태는 유지한다. Pro 연 요금도 기존 Policy 값을 표현할 뿐 가격 확정을 의미하지 않는다.

| 서버 키                                        | 값·단위    | 적용 대상 / C와 맞출 의미                                      |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `PRO_YEARLY_KRW`                               | 29000원/년 | Pro 연 결제, 기존 프론트 proYearly와 대응                      |
| `PAYMENT_FAILURE_GRACE_DAYS` (기존)            | 7일        | 결제 실패 후 혜택 유지 기간, 프론트 누락 보완 필요             |
| `TEAM_CHAT_IMAGE_ORIGINAL_RETENTION_DAYS_FREE` | 90일       | 무료 팀 채팅 이미지 원본만. 메시지 보관 기간·1:1 이미지와 별개 |
| `AI_SUMMARY_RETENTION_DAYS`                    | 7일        | 요약 결과 보관. 공유한 카드 수명과 별개                        |
| `FLEX_EXPIRY_NOTICE_DAYS_BEFORE`               | 7일 전     | Flex 종료 및 종료 후 유예 만료 각각의 팀 전체 사전 알림        |
| `CHAT_SHARES_PER_MINUTE`                       | 10회/분    | 채팅방 공유 동작. 일반 메시지 전송 제한과 별개                 |
| `CHAT_SHARES_PER_DAY`                          | 100회/일   | 같은 공유 동작의 일일 한도                                     |
| `FLEX_INCLUDED_SEATS` (기존)                   | 6명        | Flex 기본 요금 포함 인원. 무료 팀 정원과 의미가 다름           |

C는 프론트 상수 및 구독 화면·목업의 Flex 포함 인원 참조를 보완한다. 프론트 키 이름은 언어별 관례에 따라 달라도 되지만 의미·값·단위를 맞춰 최종 확인한다. 서버 이번 변경은 상수 선언만이며 한도 집행·보관 삭제·알림 스케줄 기능을 추가하지 않는다. 공통 기술 설정을 제외한 새 API·DB 변경도 없다.

### 프론트 보완·최종 대조

사용자 요청으로 D가 프론트 보완도 함께 수행했다. 위 표의 프론트 누락은 아래 키로 해소했다. 정책 자체의 잠정 상태는 유지한다.

| 서버                                           | 프론트                                          | 동일 값  |
| ---------------------------------------------- | ----------------------------------------------- | -------- |
| `PRO_YEARLY_KRW`                               | `SUBSCRIPTION_PRICE.proYearly` (기존)           | 29000원  |
| `PAYMENT_FAILURE_GRACE_DAYS`                   | `SUBSCRIPTION_RULES.paymentFailureGraceDays`    | 7일      |
| `TEAM_CHAT_IMAGE_ORIGINAL_RETENTION_DAYS_FREE` | `CHAT.teamImageOriginalRetentionDaysFree`       | 90일     |
| `AI_SUMMARY_RETENTION_DAYS`                    | `CHAT.aiSummaryRetentionDays`                   | 7일      |
| `FLEX_EXPIRY_NOTICE_DAYS_BEFORE`               | `SUBSCRIPTION_RULES.flexExpiryNoticeDaysBefore` | 7일 전   |
| `CHAT_SHARES_PER_MINUTE`                       | `CHAT.sharesPerMinute`                          | 10회/분  |
| `CHAT_SHARES_PER_DAY`                          | `CHAT.sharesPerDay`                             | 100회/일 |
| `FLEX_INCLUDED_SEATS`                          | `SUBSCRIPTION_PRICE.flexIncludedSeats`          | 6명      |

구독 화면, 결제 목업, 팀 설정의 Flex 금액 계산은 새 포함 인원 키를 사용한다. 무료 정원 키는 무료 정원 의미로 유지한다. 기존 값 대조 결과와 함께 누락 항목을 보완했으며, 이슈 고정·C의 확인은 별도다. 실행 기능·정책 확정 여부는 바꾸지 않았다.
