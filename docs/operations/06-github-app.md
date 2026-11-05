# GitHub App · 웹훅 · 설치 검증 — B 백엔드 00

범위는 백엔드 조율 순서 3번의 GitHub App·웹훅 기반·설치 검증 스파이크다. WBS의 경로를 사용하고 08 전체 팀 생성·보드·채팅방 생성은 후속 작업으로 둔다.
0번의 OpenAPI 태그·공통 오류 표·Sentry를 이 문서로 확정하지 않는다. 기존 오류 형식을 유지하고 새 공통 오류 코드를 추가하지 않는다.

## 현재 연결 상태

| 항목 | 코드 상태 / 남은 확인 |
| --- | --- |
| 웹훅 | 원문 HMAC 검증·delivery 중복 방지·DB 수신 저장·Redis 큐·처리 실패 기록·재시도·수신 기록 재큐잉 |
| GitHub App 인증 | 별도 App RSA 키로 RS256 JWT 생성. PKCS#1/PKCS#8 PEM 지원. A의 세션 JWT 키와 분리 |
| 설치 검증 | 사용자·세션에 묶인 Redis 일회용 state → 서버의 사용자 토큰으로 `GET /user/installations` 조회 → 현재 App·Organization·정지 여부 검증 |
| A 연결점 | `GithubUserAccessTokenSource.tokenFor(userId)` 구현 필요. 없으면 503 `SERVICE_UNAVAILABLE`; 임시 사용자 토큰을 환경변수나 요청 본문으로 받지 않음 |
| 실환경 스파이크 | 실제 GitHub App·키·테스트 조직과 A의 사용자 토큰 경로가 준비된 후 수행. 자동 테스트 통과와 별개 |
| E 스토리지 | 업체 미결정 유지. 별도 업로드 API·클라우드 설정을 추가하지 않음 |

## App 등록 설정

PRD §8·페이지 TODO 00 기준이다. App 이름과 소유 계정은 팀이 정한다.

| 구분 | 설정 |
| --- | --- |
| 계정 권한 | Email addresses: read |
| 저장소 권한 | Metadata: read, Contents: read, Issues: read/write, Pull requests: read |
| 조직 권한 | Members: read/write, Projects: read/write |
| 이벤트 | `issues`, `pull_request`, `projects_v2_item`, `organization`, `installation` |
| 사용자 로그인 callback | A의 `/auth/callback` 계약과 맞춤 |
| 설치 후 Setup URL | 웹의 `/teams/new/callback`. 로그인 callback과 구분 |
| 웹훅 URL | 운영은 `https://linker.newlecture.com/api/v1/webhook/github`, 개발은 테스트용 smee 채널 |
| Webhook secret | 서버 `GITHUB_WEBHOOK_SECRET`와 일치 |

GitHub의 “Request user authorization during installation” 옵션을 켜면 Setup URL 대신 사용자 인증 callback으로 복귀하는 흐름이 된다. 이번 스파이크의 별도 Setup URL 흐름과 혼합하지 않고 A와 설정을 맞춘다.
앱 로그인 복귀는 기존 `linker://auth` 브리지 계약을 유지하며 JWT·GitHub 토큰을 URL·브리지로 전달하지 않는다.

## 서버 환경변수

실제 비밀값은 저장소·이슈·PR에 넣지 않는다. App 키는 GitHub 설정에서 받은 RSA PEM을 사용하며 A의 `JWT_PRIVATE_KEY`를 재사용하지 않는다.

| 키 | 의미 / 기본값 |
| --- | --- |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` | GitHub App ID / 설치 URL에 쓰는 slug |
| `GITHUB_APP_PRIVATE_KEY` | 별도 App RSA PEM. 한 줄의 `\n` 표기도 지원 |
| `GITHUB_WEBHOOK_SECRET` | 웹훅 원문 서명 검증용 secret |
| `GITHUB_API_BASE_URL` / `GITHUB_API_VERSION` | `https://api.github.com` / `2026-03-10` |
| `GITHUB_HTTP_TIMEOUT` | 연결·응답 timeout 기본 `10s` |
| `GITHUB_INSTALL_STATE_TTL` | 일회용 설치 state 기본 `10m` |
| `GITHUB_WEBHOOK_MAX_ATTEMPTS` | 실패 횟수 상한 기본 `5`. 도달 시 FAILED 유지 |
| `GITHUB_WEBHOOK_RETRY_DELAY` | 처리 실패 후 재시도 최소 간격 기본 `30s` |
| `GITHUB_WEBHOOK_RECEIVED_TIMEOUT` | 큐에서 유실된 RECEIVED 재확인 간격 기본 `60s` |
| `GITHUB_WEBHOOK_RECOVERY_BATCH_SIZE` | 복구 조회 한 번의 최대 건수 기본 `100` |
| `GITHUB_WEBHOOK_RECOVERY_DELAY_MS` | 복구 스캔 주기 기본 `60000`ms |
| `LINKER_WEBHOOK_CONSUMER_ENABLED` | 일반 앱 기본 true. `remote_db.py backend`의 공용 DB 개발은 기본 false |

루트 `.env`의 설정은 Compose가 backend에 전달한다. `python3 scripts/remote_db.py backend`도 위 GitHub 설정과 세션 JWT 키를 `.env`에서 읽되 기존 프로세스 환경변수를 우선한다. DB 접속은 `.env.remote-db`, worker 활성화는 명시적인 프로세스 환경변수 기준을 유지한다. IDE/`./gradlew bootRun`으로 직접 실행한다면 Spring 프로세스 환경변수로 전달한다.
`.env.remote-db`에 위 App 설정을 추가하지 않는다. 그 파일은 DB 도우미의 제한된 개인 접속 설정용이다.
운영 서버의 App 설정은 기존 서버 `.env` 관리 절차를 따르며, 실제 App 등록·배포를 코드 구현 완료와 혼동하지 않는다.

## 설치 검증 호출과 A 연결

로그인한 활성 개발자만 아래 경로를 사용한다. 응답은 `Cache-Control: no-store`다.

1. `GET /api/v1/user/team-setup/install-url` → `{installUrl, state}`. 원본 state 대신 SHA-256 키와 사용자·세션 binding을 Redis에 TTL로 보관한다.
2. 시스템 브라우저에서 `installUrl`을 열고 설치 후 웹의 Setup URL로 돌아온다.
3. `POST /api/v1/user/team-setup/installations/verify`에 `{installationId: "...", state: "...", setupAction: "install"}`를 전달한다(`update`도 허용).
4. state를 원자적으로 한 번만 소비하고, 서버 사용자 토큰의 설치 목록 전체 페이지에서 설치를 검증한다. URL의 설치 ID·`setup_action` 자체는 성공 근거가 아니다.
5. 검증된 설치는 `{result:"INSTALLED", org:{id,login,avatarUrl}, installationId:"..."}`로 응답한다. GitHub 토큰은 응답하지 않는다.

state 만료·재사용·잘못된 계정/세션은 400이다. 설치 권한·App·조직 조건 불일치는 403이며, GitHub 사용자 토큰 만료는 기존 `LOGIN_REQUIRED`로 재로그인을 요청한다.
일회용 state는 실패 후에도 재사용하지 않는다. 새 설치 요청으로 다시 시작한다.

A는 서버 내부 `GithubUserAccessTokenSource` bean에서 사용자 토큰을 복호화·갱신해 반환한다. GitHub HTTP 호출 전에 저장/조회 트랜잭션을 끝낸다. 토큰 저장 암호화 방식·로그인 구현을 B가 중복 결정하지 않는다.
`GithubAppClient.installationReadToken(id)`는 서버 내부 읽기용 설치 토큰을 발급·캐시하고 만료 전에 갱신한다. 사용자 토큰 대신 쓰지 않으며, 401/권한 변경 시 호출자는 `invalidateInstallationToken(id)` 후 재판단한다.

`REQUESTED_FROM_OWNER`·`ALREADY_LINKED` 및 실제 팀 연결 여부는 08의 승인/팀 데이터 계약과 함께 후속 연결한다. 지금은 설치 목록에 없다는 이유만으로 “오너 승인 대기”를 추측하지 않는다.
이 스파이크는 `github_installations`/팀 행을 생성하지 않는다. 이후 팀 생성 시 서버에서 다시 검증한 뒤 ERD에 따라 저장해야 하며, 이 응답만으로 팀 생성 권한을 부여하면 안 된다.

## 웹훅 처리와 C 연결

- 기존 `POST /api/v1/webhook/github`: 신규 수신 202, 동일 delivery 재수신 200. 서명·중복 검사 후 원문과 event/action/installation ID를 DB에 저장하고 큐에는 **DB delivery 행 ID**만 넣는다.
- `GithubWebhookHandler.supports(event)` / `handle(delivery)`를 통해 전달한다. delivery는 조회 snapshot이며, handler 호출 중 ambient DB 트랜잭션은 없다. 핸들러의 업무 저장은 짧은 자체 트랜잭션으로 처리한다.
- V1의 `delivery.installationId`는 외부 GitHub 설치 ID다. 08의 내부 `github_installations.id`와 같다고 가정하지 않고 `github_installation_id`로 조회한다. 계획된 FK 전환은 08의 마이그레이션에서 맞춘다.
- `ping`은 부수 효과 없이 처리한다. 아직 소비 핸들러가 없는 이슈/보드 이벤트는 RECEIVED를 유지해 나중에 소비할 수 있게 한다.
- 동일 delivery의 동시 소비는 PostgreSQL 세션 advisory lock으로 막는다. **음수 bigint 키 `-deliveryRowId`를 이 용도로 예약**한다. 외부 호출 중 DB 트랜잭션은 없으나 worker당 잠금용 연결 하나를 사용하므로 DB 풀은 별도 업무 트랜잭션용 연결 여유가 필요하다(단일 worker도 최소 2개).
- 성공·실패 상태 저장만 짧은 DB 트랜잭션으로 수행한다. 실패 횟수와 정제된 `HANDLER_FAILED`를 남기고 원본 예외 본문·토큰을 저장하지 않는다.
- 복구 스캔은 DB의 오래된 RECEIVED와 상한 미만 FAILED를 다시 큐에 넣는다. 큐 등록 실패·pop 후 worker 종료도 복구 대상이다. 재큐잉 시 `updated_at`을 갱신해 미소비 이벤트가 계속 조회 앞부분을 독점하지 않게 한다.
- 전달은 **at least once**다. 여러 handler 중 일부만 완료되거나 업무 저장 후 worker가 종료되면 재처리될 수 있으므로 C 등 소비자는 `deliveryId`/업무 식별자로 멱등 처리한다. 서로 다른 delivery 사이의 이슈 갱신 순서는 C와 별도 조율한다.
- 수신 전 네트워크 실패는 DB에 기록되지 않는다. GitHub의 자동 재전송을 전제하지 않고 GitHub Recent deliveries의 수동/API redelivery로 확인한다. 처리 완료 기록의 30일 정리는 ERD 기준 후속 운영 작업이며 이번 스파이크 완료에 포함하지 않는다.

새 PROCESSING 상태·테이블·컬럼은 추가하지 않았다. C의 보드/이슈 매핑과 이전 별도 캐시 연결 요청을 이 구현에 포함하지 않는다. 이벤트 의미의 최종 freeze는 B↔C 확인 후 진행한다.
순서 4의 이벤트·필드 목록, A 이슈 #180의 B 확인 결과와 D 알림 인자 기록은 [B 교차 계약 확인](../development/plans/b-backend-cross-contracts.md)을 따른다. 이 계약 정리는 새 API 구현이나 실환경 스파이크 통과를 뜻하지 않는다.

## 실제 스파이크 순서

공용 DB+개인 Redis 대신 테스트용 로컬 DB·Redis·조직을 사용한다. 테스트용 루트 `.env`에 로컬 DB 비밀번호, A의 세션 키와 GitHub App 설정을 준비한 뒤 다음을 실행한다.

```bash
docker compose up -d --build backend
npx smee-client --url https://smee.io/팀의테스트채널 --target http://127.0.0.1:8080/api/v1/webhook/github
```

1. GitHub App의 Webhook URL을 테스트 채널에 연결하고 ping을 보낸다. DB의 `github_webhook_deliveries`와 PROCESSED를 확인한다.
2. 같은 delivery를 redeliver해 중복 행이 생기지 않는지 확인한다.
3. 설치 → Setup URL → 사용자 토큰 재검증을 확인한다. 잘못된 ID·다른 계정·만료/재사용 state도 거절되는지 확인한다.
4. Redis 중단·worker 종료 후 원래 데이터 볼륨을 유지해 복구되는지 확인한다. 실제 업무 handler 실패 재시도는 각 소비자가 연결된 후 확인한다.

GitHub App/키와 A의 실제 사용자 토큰 경로가 없으면 이 절차를 통과로 표시하지 않는다. 자동 테스트는 Testcontainers의 별도 PostgreSQL·Redis와 모의 GitHub API를 사용하며 공용 DB를 초기화하지 않는다.

## 근거

- [Setup URL과 설치 ID 재검증](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url)
- [사용자 토큰 설치 목록](https://docs.github.com/en/rest/apps/installations#list-app-installations-accessible-to-the-user-access-token)
- [App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app)
- [웹훅 실패 재전송](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)
- [smee-client](https://github.com/probot/smee-client)
