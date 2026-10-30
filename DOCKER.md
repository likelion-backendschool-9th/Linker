# Docker Compose 로컬 실행

Nginx, Next.js 웹, Spring Boot, PostgreSQL 16, Redis 7을 함께 실행하는 로컬 구성입니다.
Docker Engine/Desktop과 Docker Compose가 필요하며 Node·pnpm·Java는 컨테이너에서 설치합니다.

## 시작 전 준비

루트 `.env`가 없다면 `.env.example`을 복사하고 `DB_PASSWORD`를 설정합니다.
이미 `.env`가 있으면 덮어쓰지 말고 필요한 키만 추가하세요.

```bash
cp .env.example .env
```

최초 빌드는 Node·Java 이미지와 의존성을 내려받으므로 시간이 걸릴 수 있습니다.
`.env`의 비밀값은 커밋하지 않습니다.

## 화면 개발: 저장하면 바로 반영

Docker Compose **5.6.0 이상**에서 다음 개발용 명령을 사용합니다. `docker compose version`으로 버전을 확인할 수 있습니다. 로컬·CI 검증 기준은 5.6.0이며, 기존 2.32.x는 `initial_sync` 설정을 인식하지 못합니다.

```bash
docker compose -f compose.yml -f compose.dev.yml up --build --watch
```

터미널을 열어 둔 채 **http://localhost:8000**에 접속하고 프론트 파일을 수정·저장하면 됩니다.
Compose Watch가 소스를 컨테이너로 복사하고 Next.js 개발 서버가 변경을 반영합니다. 페이지·컴포넌트·CSS 수정에는 이미지 재빌드가 필요하지 않습니다.
일부 변경은 Fast Refresh 대신 브라우저 전체 새로고침으로 반영될 수 있습니다.

| 변경 대상 | 개발 모드 동작 |
| --- | --- |
| `frontend/apps/web`의 소스·정적 파일 | 동기화 후 Next.js에서 반영 |
| `frontend/packages`의 공유 소스·생성 API | 동기화 후 사용하는 화면에서 반영 |
| `next.config.ts` | 동기화 후 웹 컨테이너 자동 재시작 |
| package.json·pnpm-lock.yaml·workspace 설정·Dockerfile | 웹 이미지 자동 재빌드·컨테이너 재생성 |
| `.env` 등 환경변수 | 자동 동기화하지 않음. 실행을 종료한 뒤 변경하고 `--build`로 다시 시작 |
| 백엔드 소스 | 자동 반영 대상 아님. 백엔드 이미지 재빌드 필요 |

라이브러리를 추가할 때는 호스트의 package.json과 lockfile을 함께 갱신해야 합니다. 동기화는 **호스트 → 컨테이너 단방향**이므로 컨테이너 안에서만 수정한 파일은 호스트에 저장되지 않습니다.
`node_modules`, `.next`, 실제 `.env`는 동기화하지 않습니다. 호스트와 컨테이너의 의존성·빌드 파일이 섞이지 않으며 소스를 호스트에 root 소유로 생성하지 않습니다.
Nginx는 Next.js 자동 갱신용 `/_next/hmr`·`/_next/webpack-hmr` 연결을 웹으로 전달합니다. Spring 채팅용 `/ws`와는 다른 연결입니다. 개발 리소스 접근은 `localhost`·`127.0.0.1`을 허용합니다.

개발 종료는 실행 터미널에서 **Ctrl+C**를 누르고, 컨테이너를 제거하려면 다음 명령을 사용합니다. 데이터 볼륨은 유지됩니다.

```bash
docker compose -f compose.yml -f compose.dev.yml down
```

백그라운드 실행이 필요하면 아래처럼 시작한 뒤, 두 번째 명령으로 파일 감시를 유지할 수도 있습니다.

```bash
docker compose -f compose.yml -f compose.dev.yml up -d --build --wait --wait-timeout 240
docker compose -f compose.yml -f compose.dev.yml watch --no-up
```

파일 감시를 종료하면 이후 저장한 변경은 자동 반영되지 않습니다. 다시 시작할 때 초기 동기화로 중간에 수정한 소스를 반영합니다.

## 빌드된 앱 실행: 배포 전 확인

기존 명령은 계속 빌드된 앱을 실행합니다. 이 모드는 소스 변경 후 재빌드가 필요합니다.
두 모드는 같은 서비스·포트를 사용하므로 동시에 실행하지 말고, 기존 모드를 종료한 뒤 전환하세요.

```bash
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

개발 설정을 지정하지 않으면 Dockerfile의 마지막 `runtime` 단계를 사용합니다. 개발 서버와 Compose Watch는 실제 공개 서버에서 사용하지 않습니다.

| 서비스 | 로컬 주소 | 준비 상태 확인 |
| --- | --- | --- |
| Nginx (기본 접속 주소) | http://localhost:8000 | Nginx를 통한 홈 화면 HTTP 응답 |
| 웹 (직접 접근·디버깅용) | http://localhost:3000 | 홈 화면 HTTP 응답 |
| Spring (직접 접근·디버깅용) | http://localhost:8080 | 8080 포트에서 연결 수신 |
| PostgreSQL | localhost:5500 | `pg_isready` |
| Redis | localhost:6379 | `redis-cli ping` |

웹에서는 현재 초기 세팅 확인 화면이 표시됩니다. Spring은 아직 API가 없어 `/`가 404를 반환하는 것이 정상입니다.
Spring의 포트 검사는 API·인증·DB·Redis 기능의 통합 검증을 의미하지 않습니다.
DB·Redis 자체 healthcheck가 통과한 뒤 Spring을 시작하고, Spring이 연결을 수신한 뒤 웹을 시작합니다. Nginx는 웹·Spring이 준비된 뒤 시작합니다.
각 호스트 포트는 `127.0.0.1`에만 열립니다. 기존 로컬 서버가 같은 포트를 쓰면 먼저 해당 서버를 중지하거나 Compose의 호스트 포트를 조정하세요.

## Nginx 요청 경로

브라우저에서는 **http://localhost:8000**으로 접속합니다. 같은 주소의 API 요청을 Nginx가 Spring으로 전달하므로 Compose 실행 시 브라우저 REST 요청에 별도 API 도메인이 필요하지 않습니다.

| 경로 | 전달 대상 | 현재 상태 |
| --- | --- | --- |
| `/`, 정적 파일 등 | Next.js `web:3000` | 초기 세팅 화면 제공 |
| `/api/v1/*` (GitHub 웹훅 포함) | Spring `backend:8080` | 경로·쿼리·메서드·본문·쿠키를 전달. API는 후속 구현 |
| `/api/bff/*` | Next.js `web:3000` | BFF 구현을 위한 경로 예약. 현재 404 |
| `/ws`, `/ws/*` | Spring `backend:8080` | WebSocket Upgrade 헤더·300초 timeout 설정. STOMP 서버 구현 전에는 404 |
| `/_next/hmr`, `/_next/webpack-hmr` | Next.js `web:3000` | 개발 모드의 브라우저 자동 갱신 연결 |

`nginx/default.conf`가 위 경로를 정의합니다. 컨테이너가 재생성되어 IP가 바뀌면 Docker DNS로 다시 조회합니다.
인증 쿠키를 JavaScript에 노출하거나 별도의 사용자 ID 헤더로 변환하지 않습니다. 실제 로그인·쿠키 발급·WebSocket 권한 검사는 아직 구현 전입니다.
인증이 구현되면 STOMP heartbeat를 프록시 timeout보다 짧게 설정하고 실제 송수신·재연결을 검증해야 합니다.
이 단계는 HTTP 로컬 실행용입니다. 운영 HTTPS·인증 쿠키·외부 웹훅 주소는 서버·도메인이 결정된 뒤 설정합니다.

## 환경변수와 네트워크

- 기존 DB 이름·사용자 `linker`와 PostgreSQL 볼륨을 유지합니다. 이미 초기화한 볼륨의 DB 비밀번호는 `.env` 값만 바꿔도 변경되지 않습니다. 기존 비밀번호를 사용하거나 DB에서 별도로 변경하세요.
- 호스트에서 직접 실행하는 Spring은 `.env.example`의 `DB_URL`과 `DB_USERNAME`을 사용합니다. Compose는 `DB_URL=jdbc:postgresql://db:5432/linker`, `DB_USERNAME=linker`로 덮어씁니다. 컨테이너 안의 `localhost`는 호스트 PC가 아닙니다.
- Spring Redis 연결은 Compose에서 `REDIS_HOST=redis`로 설정합니다. 호스트에서 직접 실행할 때 기본값은 `localhost:6379`입니다. Redis 클라이언트 기반만 추가하며 알림 큐·제한 정책·STOMP 기능은 후속 작업입니다.
- Compose는 브라우저용 `NEXT_PUBLIC_API_BASE_URL`을 빈 문자열로 빌드합니다. `/api/v1/*` 요청은 현재 접속한 Nginx 주소를 사용합니다. 이전 `.env`의 `WEB_API_BASE_URL`은 더 이상 사용하지 않습니다.
- Nginx 호스트 포트는 `PROXY_PORT`(기본 `8000`)로 바꿀 수 있습니다. 변경 후 컨테이너를 재생성하면 됩니다. 직접 `pnpm dev`로 개발할 때는 `frontend/apps/web/.env.example`의 API 주소 설정을 사용합니다.
- 웹 서버 내부 API 요청은 서버 전용 `API_INTERNAL_URL=http://backend:8080`을 사용합니다. 브라우저에 이 내부 주소를 전달하지 않습니다.
- 이미지 저장소를 연결하면 `NEXT_PUBLIC_IMAGE_HOST`를 지정하고 웹 이미지를 다시 빌드합니다.
- 현재 브라우저 REST는 Nginx를 거쳐 Spring을 호출하며 Next.js BFF는 아직 없습니다. 직접 접근용 3000 포트 대신 기본 Nginx 주소를 사용하세요. BFF·HTTPS·쿠키 인증·STOMP 구현은 후속 작업입니다.

## 로그·변경 반영·종료

```bash
docker compose logs -f proxy backend web
docker compose exec proxy nginx -t
docker compose exec redis redis-cli ping
docker compose exec db pg_isready -U linker -d linker

# 소스 변경 후 이미지 재빌드 및 컨테이너 재생성
docker compose up -d --build --wait --wait-timeout 240

# 컨테이너 종료 (DB·Redis 볼륨은 유지)
docker compose down
```

기본 구성은 빌드된 앱을 실행하며, `compose.dev.yml`을 함께 지정하면 개발 서버와 소스 동기화 규칙을 사용합니다.
웹 이미지는 프론트 모노레포를 컨텍스트로 사용하고 `web` 및 공유 패키지 의존성만 설치합니다. Expo 앱은 이미지에 포함하지 않습니다.
Next.js standalone 서버는 공유 패키지를 포함하도록 모노레포 루트까지 파일을 추적합니다.
API 생성은 실행 중인 서버에 의존하므로 이미지 빌드 중 자동 실행하지 않습니다. 페이지가 생성 API를 사용하게 되면 빌드 전에 OpenAPI 기반 생성물을 준비해야 합니다.

## 다음 단계

1. 로컬에서 다섯 서비스가 준비되고 Nginx 주소에서 웹 화면이 열리는지 확인
2. 별도 작업 브랜치에서 BFF 구현, 세션 쿠키 전달 및 STOMP 연결 검증
3. 개발·운영 Compose 설정 분리, 운영 로그·재시작·자원 제한 구성
4. 서버·도메인 결정 후 HTTPS·외부 연동·백업 설정
