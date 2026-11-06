# GitHub App·웹훅 공동 검증

각자 GitHub 계정으로 로그인하고, 이 저장소의 동일한 도구로 검증 환경을 재현한다. App의 소유자와 로그인 사용자는 별개다. 개인 GitHub 계정·로그인 쿠키·사용자 토큰을 팀원이 함께 사용하지 않는다.

이 절차는 로컬 개발용이다. 기존 공통 계약·API·정식 Flyway 번호·운영 배포 설정을 변경하지 않는다. App 권한과 인증 계약은 [기존 안내](06-github-app.md), DB 운영은 [DB 안내](05-database-access.md)를 따른다.

## 1. 함께 쓰는 방식

| 방식 | 실행과 비밀값 보관 | 주의점 |
| --- | --- | --- |
| 담당자 한 명의 로컬 서버로 공동 검증 | 그 담당자만 App 키·secret·전용 DB를 보관한다. 다른 사람은 테스트 조직에서 이벤트를 발생시키고 담당자가 결과를 확인한다. | 현재 준비한 방식. 담당자의 PC·서버·relay가 켜져 있어야 한다. 다른 팀원은 localhost UI에 직접 접속할 수 없다. |
| 각자 로컬 검증 | 각자 테스트 조직·App·DB·Redis·smee 채널과 세션 키를 준비한다. | 다른 담당자의 App Webhook URL을 덮어쓰지 않는다. |
| 공용 HTTPS 검증 서버 | 팀이 승인한 서버에 비밀값을 보관하고, 각자 계정으로 접속한다. | 별도 서버 설정·배포·접근 범위 합의가 필요하다. 이 PR은 서버를 공개하거나 운영 App을 변경하지 않는다. |

한 App의 Webhook URL은 하나다. 같은 App을 쓰면서 서로 다른 로컬 DB로 나누어 수신하면 설치·팀 연결 상태도 달라져 C 캐시 검증이 실패할 수 있다. 공동 검증에서는 수신 담당자와 시간을 먼저 정한다. 비공개 조직 소유 App을 함께 인증할 사람은 해당 테스트 조직의 멤버로 추가한다. GitHub 비밀번호나 App 관리자 권한을 함께 사용할 필요는 없다.

## 2. 실행 도구와 개인 설정

필수 도구는 Python 3.10 이상, Docker Compose v2의 **로컬** Docker 환경, OpenSSL, Java 21, Node.js 22 이상과 저장소 지정 pnpm이다. Windows는 WSL 터미널을 사용한다. 아래 명령은 저장소 루트에서 실행한다.

```bash
python3 scripts/github-integration/run.py init
```

Git에서 제외된 `.local-notes/github-integration-test/`에 다음을 생성한다.

- `.env`: 임의 DB 비밀번호, 웹훅 secret, 토큰 암호화 키, 로컬 설정
- `session-private.pem`·`session-public.pem`: 이 환경 전용 세션 RSA 키

디렉터리는 `700`, 파일은 `600`으로 생성한다. 기존 설정·키가 있으면 중단하고 보존한다. 루트 `.env`, `.env.remote-db`, OS의 같은 이름 환경변수는 DB·GitHub 설정으로 가져오지 않는다. `init`을 다시 실행해 키를 덮어쓰지 않는다. 파일을 채팅·이슈·PR·스크린샷으로 공유하지 않는다.

개인 `.env`의 기본 포트는 PostgreSQL `55432`, Redis `56379`, 백엔드 `8080`, 웹 `3000`이다. 다른 서버가 쓰고 있으면 **처음 컨테이너를 실행하기 전에** `TEST_*_PORT`를 변경한다. 프로세스와 컨테이너는 loopback에만 바인딩된다.

다른 로컬 환경을 보존하면서 별도로 준비하려면 모든 명령에 같은 `--state-dir .local-notes/별도이름`을 명령 앞에 넣는다. 환경 디렉터리마다 Docker 프로젝트·볼륨이 분리되며, 포트도 서로 다르게 지정한다.

같은 checkout의 Next 개발 서버는 동시에 두 개 띄우지 않는다. 다른 환경으로 웹을 전환할 때는 기존 웹 터미널부터 종료한다.

## 3. 실제 App 설정

테스트 조직의 Owner 또는 App 관리자가 GitHub App을 등록한다. 개인 소유 비공개 App은 다른 조직에 설치할 수 없으므로, 테스트 조직 소유의 비공개 App을 사용할 수 있다. 설치 저장소는 테스트 저장소 하나로 제한한다.

| 항목 | 값 |
| --- | --- |
| 계정 권한 | Email addresses 읽기 |
| 저장소 권한 | Metadata·Contents·Pull requests 읽기, Issues 읽기/쓰기 |
| 조직 권한 | Members·Projects 읽기/쓰기 |
| 선택할 이벤트 | `issues`, `pull_request`, `projects_v2_item`, `organization` |
| 자동 전송 이벤트 | `installation`은 수동 선택하지 않는다. 모든 App에 기본 전송된다. |
| 웹 Callback URL | `http://localhost:3000/auth/callback` |
| 앱 Callback URL | `http://localhost:3000/auth/callback?client=app` |
| Setup URL | `http://localhost:3000/teams/new/callback` |
| Webhook URL | 개발 전용 smee 채널. 운영은 승인된 HTTPS 웹훅 주소 |

웹 포트를 변경했다면 위 URL 세 개의 포트도 맞춘다. `Request user authorization during installation`은 끄고 Setup URL을 유지한다. App 설치 승인은 조직 권한 부여, 사용자 Authorize는 개인 인증 권한 부여이므로 각각 내용을 확인한다.

개인 `.env`의 아래 빈 항목을 입력한다. App 개인키는 GitHub가 발급한 RSA PEM이며 한 줄 `\n` 표기를 쓴다. 인용부호를 사용할 수 있지만 셸 명령이나 변수 치환은 실행되지 않는다.

```dotenv
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
TEST_SMEE_URL=
```

`GITHUB_WEBHOOK_SECRET`은 `init`이 만든 값과 GitHub App 설정을 같게 맞춘다. 이미 GitHub가 secret을 발급한 경우 개인 `.env`를 그 값으로 맞춘다. App 키와 세션 JWT 키는 다르다. DB에 토큰이 저장된 후 `GITHUB_TOKEN_ENCRYPTION_KEY`를 교체하면 기존 토큰을 복호화할 수 없다.

실제 값은 이 저장소에 들어 있지 않으므로 `pull`만으로 실제 App 인증이 완성되지는 않는다. App 관리자 한 명의 서버를 함께 사용할 때는 그 서버에만 App 비밀값을 보관한다. 프론트 프로세스에는 세션 **공개키**와 공개 URL만 전달하며 App·세션 개인키, client secret, DB 비밀번호, 암호화 키를 전달하지 않는다.

Gradle 빌드에도 백엔드 자격증명을 전달하지 않고, 실제 백엔드 실행 프로세스에만 필요한 값을 전달한다.

## 4. DB·Redis·백엔드 실행

터미널 1:

```bash
python3 scripts/github-integration/run.py up
python3 scripts/github-integration/run.py backend --build
```

일반 Spring 부팅으로 현재 저장소의 정식 Flyway 이력이 먼저 적용된다. B/C 소비 플래그는 기본 꺼짐이다. 서버가 시작되면 터미널 2에서:

```bash
python3 scripts/github-integration/run.py schema
python3 scripts/github-integration/run.py check
python3 scripts/github-integration/run.py smoke
```

`schema`는 전용 Docker 프로젝트의 `linker_github_test` DB만 대상으로 다음 준비본을 하나의 트랜잭션으로 적용한다.

1. B `team-foundation.sql`
2. B `team-repositories.sql` — E의 정식 `github_repos` 재사용
3. B `team-setup.sql`
4. C `issue-cache.sql`
5. C `issue-sync-jobs.sql`

이것은 **격리 로컬 검증의 준비본 적용**이다. 정식 Flyway 편입이나 공유 DB 적용 완료가 아니다. 임의로 V 번호를 붙이지 않는다. 이미 표시되지 않은 팀 스키마가 있거나 준비 SQL 해시가 바뀌면 덮어쓰지 않고 중단한다. 기존 DB 이력과 마이그레이션 번호는 A/B/C/D/E가 별도로 조율한다.

`smoke`는 **합성** ping으로 서명 `202`·동일 delivery `200`·잘못된 서명 `401` 및 큐 처리 후 DB `PROCESSED`를 확인한다. 이를 실제 GitHub 발신 검증으로 기록하지 않는다. `check`의 “configured”도 App 설정 존재 확인이며 인증 성공을 의미하지 않는다.

실제 App 설정과 스키마가 준비되면 터미널 1의 백엔드를 `Ctrl+C`로 종료하고 다시 시작한다.

```bash
python3 scripts/github-integration/run.py backend --enable-sync
```

이 옵션은 위 준비 SQL 해시와 App 필수 설정을 확인한 뒤 **해당 로컬 프로세스에서만** B/C 웹훅·동기화 소비를 켠다. 기본 애플리케이션 설정·Compose·공용 서버 플래그는 바꾸지 않는다.

## 5. 웹·실제 웹훅

프론트 의존성이 없다면 먼저 `pnpm --dir frontend install --frozen-lockfile`을 실행한다. 각 명령은 별도 터미널에서 실행한다.

```bash
python3 scripts/github-integration/run.py web
```

```bash
python3 scripts/github-integration/run.py relay
```

relay는 공식 npm의 `smee-client@5.0.0`을 사용한다. 개발 테스트 데이터만 보내고, 채널 주소를 PR에 공개하지 않는다. Smee는 인증된 비공개 저장소가 아니며 운영 데이터용이 아니다.

1. `http://localhost:3000`에서 **본인 GitHub 계정**으로 로그인한다. 첫 사용자는 약관·온보딩을 직접 완료한다. 토큰을 요청 본문에 임의로 넣거나 타인의 로그인 쿠키를 가져오지 않는다.
2. GitHub App의 Advanced → Recent deliveries에서 `ping` 또는 실제 이벤트의 GUID를 확인한다.
3. App 생성 직후 설정 반영 전에 배달됐던 ping은 GitHub의 Redeliver로 다시 보낸다.
4. 같은 GUID를 로컬 DB에서 확인한다.

```bash
python3 scripts/github-integration/run.py delivery 실제-delivery-GUID
```

Smee 쪽 HTTP `200`은 중계 수신 성공일 수 있다. 반드시 **로컬 DB의 동일 GUID·event·action·PROCESSED**까지 확인한다. 이 명령은 토큰·쿠키·이메일·원문 payload를 출력하지 않는다. GitHub는 실패 웹훅을 자동 재전송하지 않는다. 서버 내부의 재시도와 GitHub 재전송은 구분한다.

## 6. A/B/C/D 검증 경계

| 담당 | 검증 |
| --- | --- |
| A ↔ B | 본인 로그인·서버 사용자 토큰 저장 → `install-url`의 세션 바인딩 state → 설치 복귀 → `installations/verify`. 다른 계정·잘못된 설치 ID·만료/재사용 state 거절 |
| B | 팀 생성 → 실제 저장소·보드 연결 → 최초 동기화. 설치 삭제/재설치와 조직 상태 변화 |
| B ↔ C | GitHub에서 보드 상태·시작일·마감일 변경 → `projects_v2_item` 수신 → 동일 delivery 처리 → DB 캐시와 C 조회 API 일치 |
| B ↔ D | PR 수신·캐시와 채팅 시스템 메시지 연결. PR 시스템 메시지는 #100 후속 구현 범위이며 수신 성공으로 완료 표시하지 않음 |

현재 `/teams/new/callback`은 서버 검증을 실행하지 않는 결과 미리보기다. 전체 페이지 연동은 #79 후속 범위이므로, 실제 설치 검증·팀 생성 API를 로그인 세션으로 호출한 근거와 화면 연동 완료를 구분한다. JWT는 httpOnly 쿠키로 유지하고 JavaScript·native bridge로 전달하지 않는다.

2026-11-06에 별도 테스트 환경에서 실제 App 개인키 인증·권한·GitHub 로그인·`ping`·`installation.created`의 로컬 `PROCESSED`까지 확인했다. 이 기록은 상태·날짜 변경의 C 캐시 반영, 재시도·복구와 전체 화면 왕복 통과를 뜻하지 않는다. App ID·키·secret·개인 토큰·채널 주소는 공유 기록에 포함하지 않는다.

## 7. 종료·보관

백엔드·웹·relay 터미널은 각각 `Ctrl+C`로 종료한다. 전용 컨테이너는 아래 명령으로 종료하며 데이터 볼륨은 보존한다.

```bash
python3 scripts/github-integration/run.py down
```

원본 DB dump, `.env`, PEM, 로그인 코드·쿠키, 웹훅 원문 로그를 PR에 첨부하지 않는다. 공동 검증이 끝나면 App 관리자가 테스트 설치·개인 인증의 유지/해제를 결정하고 불필요한 자격증명을 정리한다. 이 도구에는 자동 볼륨 삭제·조직 초대·App 설치·권한 확대·운영 배포 기능이 없다.

## 8. 도구 자체 검사

```bash
python3 -m unittest discover -s scripts/tests -p 'test_github_integration.py' -v
```

새 `GitHub integration tools` workflow가 비밀값·DB 격리 회귀와 전용 Compose 구문을 검사한다. 실제 App 키·사용자 계정·웹훅 payload는 CI에 전달하지 않는다. 기존 애플리케이션 CI workflow는 변경하지 않는다. 실제 GitHub 왕복은 위 수동 검증 근거로 별도 확인한다.

근거: [GitHub App 공개/비공개](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private), [개발용 웹훅과 Smee](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps), [installation 자동 전송](https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation), [재전송](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks).
