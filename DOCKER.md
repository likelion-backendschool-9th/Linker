# Docker Compose 로컬 실행

Next.js 웹, Spring Boot, PostgreSQL 16, Redis 7을 함께 실행하는 초기 구성입니다.
Docker Engine/Desktop과 Docker Compose가 필요하며 Node·pnpm·Java는 컨테이너에서 설치합니다.

## 시작

루트 `.env`가 없다면 `.env.example`을 복사하고 `DB_PASSWORD`를 설정합니다.
이미 `.env`가 있으면 덮어쓰지 말고 필요한 키만 추가하세요.

```bash
cp .env.example .env
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

최초 빌드는 Node·Java 이미지와 의존성을 내려받으므로 시간이 걸릴 수 있습니다.
`.env`의 비밀값은 커밋하지 않습니다.

| 서비스 | 로컬 주소 | 준비 상태 확인 |
| --- | --- | --- |
| 웹 | http://localhost:3000 | 홈 화면 HTTP 응답 |
| Spring | http://localhost:8080 | 8080 포트에서 연결 수신 |
| PostgreSQL | localhost:5500 | `pg_isready` |
| Redis | localhost:6379 | `redis-cli ping` |

웹에서는 현재 초기 세팅 확인 화면이 표시됩니다. Spring은 아직 API가 없어 `/`가 404를 반환하는 것이 정상입니다.
Spring의 포트 검사는 API·인증·DB·Redis 기능의 통합 검증을 의미하지 않습니다.
DB·Redis 자체 healthcheck가 통과한 뒤 Spring을 시작하고, Spring이 연결을 수신한 뒤 웹을 시작합니다.
각 호스트 포트는 `127.0.0.1`에만 열립니다. 기존 로컬 서버가 같은 포트를 쓰면 먼저 해당 서버를 중지하거나 Compose의 호스트 포트를 조정하세요.

## 환경변수와 네트워크

- 기존 DB 이름·사용자 `linker`와 PostgreSQL 볼륨을 유지합니다. 이미 초기화한 볼륨의 DB 비밀번호는 `.env` 값만 바꿔도 변경되지 않습니다. 기존 비밀번호를 사용하거나 DB에서 별도로 변경하세요.
- 호스트에서 직접 실행하는 Spring은 `.env.example`의 `DB_URL`과 `DB_USERNAME`을 사용합니다. Compose는 `DB_URL=jdbc:postgresql://db:5432/linker`, `DB_USERNAME=linker`로 덮어씁니다. 컨테이너 안의 `localhost`는 호스트 PC가 아닙니다.
- Spring Redis 연결은 Compose에서 `REDIS_HOST=redis`로 설정합니다. 호스트에서 직접 실행할 때 기본값은 `localhost:6379`입니다. Redis 클라이언트 기반만 추가하며 알림 큐·제한 정책·STOMP 기능은 후속 작업입니다.
- 브라우저 API 주소는 이미지 빌드 시 `WEB_API_BASE_URL`(기본 `http://localhost:8080`)에서 가져옵니다. 변경하면 웹 이미지를 다시 빌드해야 합니다.
- 웹 서버 내부 API 요청은 서버 전용 `API_INTERNAL_URL=http://backend:8080`을 사용합니다. 브라우저에 이 내부 주소를 전달하지 않습니다.
- 이미지 저장소를 연결하면 `NEXT_PUBLIC_IMAGE_HOST`를 지정하고 웹 이미지를 다시 빌드합니다.
- 현재는 Spring 직접 호출 구조입니다. Nginx·BFF·HTTPS·CORS/쿠키 인증·WebSocket 프록시는 별도 작업이며, 이 구성만으로 배포 환경이 완성되지는 않습니다.

## 로그·변경 반영·종료

```bash
docker compose logs -f backend web
docker compose exec redis redis-cli ping
docker compose exec db pg_isready -U linker -d linker

# 소스 변경 후 이미지 재빌드 및 컨테이너 재생성
docker compose up -d --build --wait --wait-timeout 240

# 컨테이너 종료 (DB·Redis 볼륨은 유지)
docker compose down
```

이 구성은 빌드된 앱을 실행합니다. 소스를 수정하면 재빌드가 필요하며, 개발용 hot reload 마운트는 아직 추가하지 않았습니다.
웹 이미지는 프론트 모노레포를 컨텍스트로 사용하고 `web` 및 공유 패키지 의존성만 설치합니다. Expo 앱은 이미지에 포함하지 않습니다.
Next.js standalone 서버는 공유 패키지를 포함하도록 모노레포 루트까지 파일을 추적합니다.
API 생성은 실행 중인 서버에 의존하므로 이미지 빌드 중 자동 실행하지 않습니다. 페이지가 생성 API를 사용하게 되면 빌드 전에 OpenAPI 기반 생성물을 준비해야 합니다.

## 다음 단계

1. 로컬에서 네 서비스가 준비되고 웹 화면이 열리는지 확인
2. Nginx 경로 분리와 BFF 구현, 세션 쿠키 전달 및 STOMP 연결 검증
3. 개발·운영 Compose 설정 분리, 운영 로그·재시작·자원 제한 구성
4. 서버·도메인 결정 후 HTTPS·외부 연동·백업 설정
