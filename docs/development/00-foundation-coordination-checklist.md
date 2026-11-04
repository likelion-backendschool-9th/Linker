# 00 공통 기반 (D1–D2) — A~E 조율 체크리스트

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

## 1. D1 오전 — E가 연 뒤에 시작

- [ ] **E** 모노레포·Next·tokens·`radix-ui` 골격 머지
- [ ] **E** `packages/api`(orval) + `lib/api/api-fetch` + 공통 에러 코드 처리 + `Providers`
- [ ] **A B C D** E의 fetch/orval/Provider 경로만 사용 (각자 `fetch` 금지)
- [ ] **전원** OpenAPI `@Tag` ↔ orval 파일 규칙 합의·문서화

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
- [ ] **B → A·D** 접속 정보·환경 변수 키 이름 공유

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
- [ ] **B ↔ A** 웹 로그인 콜백과 앱 딥링크 복귀 시나리오 한 장으로 맞춤 (JWT 브릿지 금지)

### C
- [ ] 스파이크: Projects 보드, Status Blocked, start/due 필드, `projects_v2_item` 웹훅
- [ ] Vitest + axe, Playwright + axe, MSW 골격
- [ ] **C ↔ B** 웹훅 이벤트 목록·페이로드 필드 freeze

### D
- [ ] STOMP 설정·인증 인터셉터·재연결
- [ ] `NotificationService.create()` **시그니처 D2 freeze**
- [ ] Redis `@RateLimit`, `PlanLimits` (숫자는 Policy / `policy.ts`와 동일 출처)
- [ ] 스파이크: Toss 테스트 결제 → confirm → cancel
- [ ] 프론트 `lib/realtime` STOMP 클라이언트
- [ ] **D → 전원** 알림 create 인자·에러 코드 공유 (이후 시그니처 변경 자제)

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

- [ ] JWT claim 필드·의미·재발급 시점 (**A**)
- [ ] 공통 에러 코드 + `api-fetch` 매핑 (**E**; `LOGIN_REQUIRED`↔A)
- [ ] `NotificationService.create()` 인자 (**D**)
- [x] `user_blocks` 열기/닫기 의미 (**E**; D 소비) — see `plans/e-block-contract-freeze.md`
- [ ] 웹훅 이벤트·큐 페이로드 (**B**; C 소비)
- [ ] OpenAPI `@Tag` 규칙 (**전원**)
- [ ] `policy.ts` 키 (**C**)
- [ ] Tech tags / job categories public API 형태 (**A**; 시트 소비자는 그대로)

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
- [ ] Projects Blocked + 날짜 필드 (**C**)
- [ ] 웹훅 수신 (**B**, C 소비 가능)
- [ ] STOMP 재연결 (**D**)
- [ ] Toss confirm/cancel (**D**)

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
- [ ] A와 auth 딥링크 정렬

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
