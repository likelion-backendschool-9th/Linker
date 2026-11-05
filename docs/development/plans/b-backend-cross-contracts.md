# 백엔드 00 B — 순서 4 교차 계약 확인

2026-11-05, `dev` 기준 커밋 `b57de1c` 및 [A↔B 이슈 #180](https://github.com/likelion-backendschool-9th/Linker/issues/180) 대조.
순서 3에서 만든 계약을 공유하고 상대 담당자의 소비 확인을 받는 단계다. 새 API·테이블·업무 핸들러는 추가하지 않는다.

| 경계 | B 확인 결과 | 남은 확인 |
| --- | --- | --- |
| A ↔ B 로그인·딥링크 | A 초안의 B 딥링크 항목 및 계약 변경 시 A·B 공유 규칙을 #180에서 체크 | 실제 GitHub 로그인·쿠키 수신은 페이지 01 구현 및 실환경 스파이크에서 확인. 로그아웃 설명 차이는 아래 참고 |
| B ↔ C 웹훅 | 아래 이벤트·DB 필드·큐·전달 경계를 B 측에서 공유 | C의 대상 식별·갱신 가능 여부, 지원 action·실제 payload 경로·지연 이벤트 처리 확인 전 공동 freeze 미완료 |
| D → B 알림 | 현행 `UserNotificationService.create(CreateNotificationCommand)` 인자 확인·기록 | 이번 단계에서는 알림 생성·발송하지 않음. D 계약 변경 시 함께 재확인 |

## 1. A 시나리오에 대한 B 확인

쿠키 속성·claim 의미·재발급은 **A가 작성한 #180**을 기준으로 한다. B가 별도 세션·토큰 체계를 만들지 않는다.
운영의 Secure·부모 도메인 쿠키 계약과 로컬 HTTP 개발의 `SESSION_COOKIE_SECURE=false`·빈 domain 기본값은 구분한다.
현재 `onb=false`는 A의 온보딩 저장 전 상태이며 B가 임의로 true로 바꾸지 않는다.

| 확인 항목 | 기존 코드 근거 |
| --- | --- |
| scheme `linker`, 복귀 `linker://auth` | [app.config.ts](../../../frontend/apps/mobile/app.config.ts), [bridge paths](../../../frontend/packages/bridge/src/paths.ts) |
| 웹 `client=web`은 같은 브라우저, 앱 `client=app`은 authorize URL만 `AUTH_GITHUB_START`로 전달 | [start-github-login.ts](../../../frontend/apps/web/src/features/auth/start-github-login.ts) |
| 앱이 시스템 브라우저를 열고, 복귀 code/state를 WebView의 `/auth/callback`으로 전달 | [native auth handler](../../../frontend/apps/mobile/src/bridge/handlers/auth.ts) |
| 시스템 브라우저의 `client=app` callback은 code를 교환하지 않고 딥링크로 전달. WebView가 callback POST 실행 | [callback-flow.tsx](../../../frontend/apps/web/src/app/(auth)/auth/callback/callback-flow.tsx) |
| WebView의 `sharedCookiesEnabled`, 세션은 쿠키 저장소에 유지 | [linker-webview.tsx](../../../frontend/apps/mobile/src/webview/linker-webview.tsx). 속성 설정을 확인한 것이며 실제 로그인 성공 증거와 구분 |
| 앱 저장값은 `{userId, userType}`만. JWT·GitHub 토큰·code·state를 SecureStore에 저장하지 않음 | [messages.ts](../../../frontend/packages/bridge/src/messages.ts), [sync-native-session.ts](../../../frontend/apps/web/src/features/auth/sync-native-session.ts), [secure-store.ts](../../../frontend/apps/mobile/src/lib/secure-store.ts) |
| 다른 딥링크 대상·불완전/중복 인증 파라미터 거절, 취소 시 `RESULT ok:false` | [paths.test.ts](../../../frontend/packages/bridge/src/paths.test.ts), [dispatcher.test.ts](../../../frontend/apps/mobile/src/bridge/dispatcher.test.ts) |

authorize-url/callback API와 서버 state·사용자 토큰 검증은 A의 페이지 01 범위다. A의 로그인 state와 B의 App **설치** state를 혼용하지 않는다.
설치 Setup URL `/teams/new/callback`은 로그인 `/auth/callback`·`linker://auth`와 별개다.

**A와 추가 확인할 로그아웃 문구:** #180에는 쿠키 삭제·CLEAR 후 푸시 토큰을 넘겨 삭제한다고 적혀 있다.
현재 [설정 화면](../../../frontend/apps/web/src/app/(member)/settings/_views/settings-common.tsx)과
[동기화 코드](../../../frontend/apps/web/src/features/auth/sync-native-session.ts)는
인증이 유효할 때 푸시 토큰 DELETE → 로그아웃 API → `AUTH_SESSION_CLEAR` 순서다.
네이티브 CLEAR는 저장값만 지우며 푸시 토큰을 다시 보내지 않는다. B 딥링크 확인은 완료했지만 이 부가 설명까지 일치한다고 간주하지 않는다.
A 원문이나 D의 푸시 계약을 임의로 수정하지 않고, A·B 확인 후 같은 이슈에서 정리한다.

## 2. B → C 이벤트 목록

PRD §8·[GitHub App 운영 안내](../../operations/06-github-app.md)의 설정 대상이다. 실제 App 등록·구독·수신 성공을 보증하는 목록은 아니다.

| event | B 전달 / 소비 경계 |
| --- | --- |
| `issues` | action과 이슈·저장소 원문 전달. C가 이슈 캐시의 지원 action·필요 필드·삭제/이동 처리 확인 |
| `projects_v2_item` | action과 프로젝트 항목 원문 전달. C가 보드·item·연결 이슈 식별, 상태·날짜 갱신 기준 확인 |
| `pull_request` | PR 원문 전달. B의 후속 PR 캐시·채팅 연계 범위이며 C Projects 핸들러에 대신 넣지 않음 |
| `organization` | 조직 원문 전달. B의 후속 조직·멤버 연계 범위 |
| `installation` | 설치 원문 전달. B의 후속 설치 상태 연계 범위 |
| `ping` | 기존 `GithubPingWebhookHandler`가 부수 효과 없이 처리 |

인입은 위 목록을 새 allowlist로 제한하지 않는다. `supports(String event)`는 이벤트 단위이며 action 필터링은 소비자가 한다.
현재 실행 핸들러는 ping뿐이고 C 핸들러는 없다. 빈 핸들러로 성공을 표시하지 않는다.

## 3. DB 필드와 큐 페이로드

기존 진입은 `POST /api/v1/webhook/github`다. HMAC-SHA256 원문 서명 검증 후 수신 저장을 커밋하고 큐에 넣는다.
정상 신규 수신은 202, 동일 delivery는 200이다. 큐 장애로 503이 나도 이미 커밋한 수신 기록은 복구 대상이다.

| 필드 | 출처 / C가 사용할 의미 |
| --- | --- |
| `id` / `deliveryRowId` | Linker DB 행 ID. **큐에는 이 숫자의 10진 문자열 하나만** 저장 (`WebhookQueue.enqueue(long)`) |
| `deliveryId` | `X-GitHub-Delivery`. GitHub delivery 중복 식별자. DB 행 ID와 구분 |
| `event` | `X-GitHub-Event`. `supports(event)`에 전달 |
| `action` | 원문 최상위 `action` 문자열. 없거나 문자열이 아니면 null. 저장 필드는 최대 128자이며 원문은 payload에 유지 |
| `installationId` | 원문의 `installation.id`. 없거나 정수가 아니면 null. V1에서는 **외부 GitHub 설치 ID**, 내부 `github_installations.id`가 아님 |
| `payload` | 원본 JSON 본문. 서명은 JSON 재직렬화 전 원본 byte로 검증. DB 저장형은 jsonb이므로 C는 JSON 의미로 읽고 공백·키 순서 보존이나 서명 재검증에 의존하지 않음 |
| `status`, `attempts`, `error`, `processedAt` | B의 처리 결과·실패 횟수·재시도 관리용. C의 이슈 갱신 시각이나 업무 상태로 사용하지 않음 |

계약 근거는 [delivery entity](../../../backend/src/main/java/com/linker/backend/entity/github/GithubWebhookDelivery.java),
[수신·전달 서비스](../../../backend/src/main/java/com/linker/backend/integration/github/GithubWebhookService.java),
[Redis 큐](../../../backend/src/main/java/com/linker/backend/async/webhook/RedisWebhookQueue.java)다.
기존 테이블의 내부 설치 FK 정렬은 08 후속 마이그레이션에서 맞춘다. 이번 단계에서는 스키마를 바꾸지 않는다.

### C가 확인할 payload 경계

- `issues`의 `issue`·`repository`, `projects_v2_item`의 `projects_v2_item`, App의 `installation`·조직 `organization` 원문을 기준으로 식별한다. 원문에 없는 이슈·저장소·필드 값은 서버 재조회로 보완하며 B가 임의 ID로 채우지 않는다.
- 실제 수신 샘플별 event/action, 프로젝트·item·연결 이슈의 숫자 ID와 node ID 경로, 상태·날짜 필드 유무를 C와 확인한다. 모든 이벤트에 같은 필드가 있다고 가정하거나 Projects 항목을 항상 Issue로 취급하지 않는다.
- 서명이 유효해도 Linker 팀·저장소에 대한 권한 검증을 대체하지 않는다. 검증된 설치·조직·팀·보드·저장소 연결을 확인한 뒤 해당 캐시만 갱신한다. 연결 조회·저장 구현은 이번 계약 정리로 완료되지 않는다.
- [C의 기존 상태·날짜·식별자 기준](c-backend-projects-contract.md)을 유지한다. 팀 작업 보드의 개인 인증 조회 성공을 서비스 App 권한·Blocked/날짜 쓰기·웹훅 수신 성공으로 간주하지 않는다.

공식 필드 근거: [issues](https://docs.github.com/en/webhooks/webhook-events-and-payloads#issues),
[projects_v2_item](https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item).
소비 action·필드 경로의 최종 freeze는 실제 샘플과 C 확인 후 진행한다.

## 4. 핸들러·재처리·토큰 경계

- 연결점은 기존 `GithubWebhookHandler.supports(String event)` / `handle(GithubWebhookDelivery delivery)`다. delivery는 조회 snapshot이며 변경 후 자동 저장에 의존하지 않는다.
- `dispatch()`의 `Propagation.NEVER`가 바깥 트랜잭션을 거절한다. C도 외부 GitHub 조회를 트랜잭션 밖에서 끝내고, 필요한 DB 변경만 짧은 자체 트랜잭션으로 묶는다. B는 전체 handler 성공 후 PROCESSED, 예외 시 FAILED를 별도 짧은 트랜잭션으로 저장한다.
- PostgreSQL 세션 advisory lock은 **동일 DB delivery 행**의 동시 실행만 막는다. 처리 중 잠금용 DB 연결 하나를 유지하므로 풀 여유가 필요하다. 서로 다른 delivery가 같은 이슈를 갱신하는 순서·충돌까지 보장하지 않는다.
- 전달은 **at least once**다. 업무 저장 직후 중단·일부 handler 성공 후 실패 시 재실행될 수 있으므로 C는 중복 저장·업무 부수 효과를 막는다. B 완료 기록과 C 업무 저장은 단일 원자적 트랜잭션이 아니다.
- 소비 핸들러가 없는 이벤트는 RECEIVED를 유지한다. 업무상 무시할 이벤트의 소비 정책·지연 이벤트의 비교 시각/재조회 기준은 C와 확인한다. 현재 B는 IGNORED를 자동 설정하지 않는다.
- FAILED의 지연·횟수 제한과 오래된 RECEIVED의 재큐잉은 [기존 운영 설정](../../operations/06-github-app.md#서버-환경변수)을 따른다. 재큐잉 시각 `updated_at`은 원본 업무 갱신 시각이 아니다. DB 복구 스캔은 GitHub 원본의 주기적 전체 재동기화를 대신하지 않는다.
- 읽기 설치 토큰은 `GithubAppClient.installationReadToken(외부설치ID)`가 서버 내부에서 공급한다. 만료 전 갱신·권한 변경 시 invalidate 경로가 있다. 실제 Projects 조회·App 권한 검증은 아직 남아 있다.
- 사용자 명의 쓰기의 사용자 토큰은 A의 `GithubUserAccessTokenSource.tokenFor(userId)` 연결점이다. 미연결이면 503이며 설치 토큰으로 대체하지 않는다. 토큰은 이슈·문서·로그·브리지에 남기지 않는다.

스파이크 실패 시 08 보드를 **“새로 만들기만”으로 줄일지** B·C가 같은 이슈에서 결정한다.
현재는 축소 미결정이며, 기존 보드 지원을 이 문서로 제거하거나 공동 스파이크 통과를 선언하지 않는다.

## 5. D → B 알림 인자 기록

현재 계약은 [CreateNotificationCommand](../../../backend/src/main/java/com/linker/backend/dto/notification/request/CreateNotificationCommand.java)와
[UserNotificationService.create](../../../backend/src/main/java/com/linker/backend/service/user/UserNotificationService.java)다.

| 인자 | Java 타입 |
| --- | --- |
| `recipientUserId` | `long` |
| `notificationType` | `String` |
| `actorUserId` | `Long` |
| `targetType` | `String` |
| `targetId` | `Long` |
| `linkPath` | `String` |
| `payloadJson` | `String` |
| `groupKey` | `String` |

B의 이후 user 팀 초대는 `notificationType=TEAM_INVITE`, `linkPath=/invite/{code}`를 사용한다.
대상·payload·groupKey의 팀 초대별 값이나 생성 시점을 이번 단계에서 새로 확정하지 않는다.
서비스 역할은 수신자 계정 종류가 아니라 생산 use case 기준이며, create는 생산 트랜잭션에 참여하는 DB 생성 경로다.
이번에는 호출·알림 행 생성·푸시·STOMP 발행을 추가하지 않는다. D의 차단·조용한 시간 정책을 B에서 복제하지 않는다.

## 6. 확인 결과와 종료 조건

2026-11-05 기존 테스트 재실행: bridge 23개, mobile 33개, web 421개, B backend 25개 모두 통과.
백엔드는 Testcontainers의 격리 PostgreSQL·Redis와 모의 GitHub를 사용했다. 공용 DB·실제 App·팀 작업 보드를 변경하지 않았다.
자동 테스트 통과는 실제 로그인·설치·웹훅·C 캐시 갱신의 실환경 통과와 별개다.

- [x] A 초안 #180의 B 딥링크 확인과 변경 시 A·B 공유 규칙 체크
- [x] B 이벤트·필드·큐·트랜잭션·재시도 경계 작성 및 기존 코드 대조
- [x] D 알림 인자·TEAM_INVITE·초대 경로 기록
- [ ] A와 로그아웃 부가 설명 차이 정리
- [ ] C가 이 필드로 대상 식별·캐시 갱신이 가능한지 확인하고 실제 action·필드 경로·지연 처리 기준을 같은 이슈에 기록
- [ ] 스파이크 실패 시 보드 지원 축소 여부를 공동 기록. 실패하지 않았다면 축소 합의 불필요

0번의 전원 OpenAPI 태그·에러 코드·Sentry 합의, D↔E 차단 소비와 C↔D 숫자는 각 담당자가 확인한다.
저장소 밖 선행·조율 순서 원본에도 B 교차 계약 링크·현재 확인 상태와 #180을 별도 반영해야 한다.
