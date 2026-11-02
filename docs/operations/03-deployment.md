# 서버 배포·운영

기준일: 2026-11-02 · 서버 계정: `linker` · 경로: `~/Linker`

## 현재 상태

- 접속 주소: **https://linker.newlecture.com/** — 외부 브라우저 접속·HTTPS 200 확인 완료.
- Docker 29.1.3 / Compose 2.40.3 / Buildx 0.30.1, 다섯 서비스 실행 확인 완료.
- 아래 운영 설정은 이번에 추가한 파일이다. **서버에 내려받고 적용하기 전까지 기존 구성으로 동작한다.**
- 실제 로그인·업무 API·WebSocket·결제 연동, DB 백업 자동화, `main` 자동 배포는 후속 작업이다.

```text
브라우저 HTTPS → 호스트 Nginx :443 → 127.0.0.1:3004
→ Docker Nginx → Next.js / Spring Boot → PostgreSQL·Redis
```

## 운영 설정

`compose.yml`에 `compose.prod.yml`을 함께 지정한다. Compose 2.24.4 이상 필요(서버 2.40.3 사용 가능).

| 항목 | 설정 |
| --- | --- |
| 호스트 포트 | Nginx의 `127.0.0.1:3004`만 사용, 다른 서비스는 Docker 내부에서 통신 |
| 재시작 | `unless-stopped`: 비정상 종료·호스트 재시작 후 복구, 명시적으로 중지한 컨테이너는 제외 |
| 로그 | 서비스별 파일당 10MB, 최대 3개로 순환 |
| CPU / 메모리 상한 | DB 1코어/1GiB, Redis 0.5코어/256MiB, 백엔드 1코어/1GiB, 웹 1코어/768MiB, Nginx 0.5코어/128MiB |
| 데이터 | 기존 프로젝트의 PostgreSQL·Redis 볼륨 유지 |
| HTTPS 정보 | 운영 Nginx가 호스트의 `X-Forwarded-Proto: https`를 웹·API·WebSocket으로 전달 |

자원 제한은 실행 중 컨테이너에 적용되며 빌드에는 적용되지 않는다. 초기 상한이므로 실제 사용량과 OOM 여부를 보고 조정한다.
DB·Redis의 호스트 포트를 닫아도 내부 연결은 유지된다. DB가 필요하면 `compose exec db`를 사용한다.

## 서버에 적용

**변경사항이 dev에 병합된 뒤** 리눅스 서버에서 실행한다. 현재 수동 배포 기준 브랜치는 `dev`이며, 이후 자동 배포는 `main`을 사용할 예정이다.

```bash
cd ~/Linker
git status --short --branch
git pull --ff-only origin dev
```

작업 파일 변경이 없고 `dev` 브랜치인지 확인한다. `.env`는 기존 파일을 유지한다.

| 환경변수 | 값 |
| --- | --- |
| `PROXY_PORT` | `3004` |
| `DB_PASSWORD` | 현재 DB를 생성할 때 사용한 비밀번호 유지 |
| `DB_URL`, `DB_USERNAME` | Compose가 내부 DB 주소·사용자로 지정 |
| `NEXT_PUBLIC_IMAGE_HOST` | 이미지 저장소 연결 시 입력 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | Toss 공개 테스트 클라이언트 키만 입력 |

`.env` 권한은 `chmod 600 .env`로 제한한다. 비밀값을 커밋하거나 공유하지 않는다.

DB에 데이터가 있다면 먼저 백업한다(서버 계정 홈에 보관).

```bash
install -d -m 700 ~/linker-backups
(umask 077; sudo docker compose exec -T db pg_dump -U linker -d linker -Fc > ~/linker-backups/linker-$(date +%Y%m%d-%H%M%S).dump)
```

구성 검사 후 운영 모드로 전환한다. **컨테이너 재생성 중 잠깐 중단될 수 있다.**

```bash
sudo docker compose -f compose.yml -f compose.prod.yml config --quiet
sudo docker compose -f compose.yml -f compose.prod.yml up -d --build --wait --wait-timeout 240
sudo docker compose -f compose.yml -f compose.prod.yml ps
curl -I https://linker.newlecture.com/
```

기존 `~/Linker`에서 같은 프로젝트 이름으로 실행해야 기존 볼륨을 사용한다. `-p`나 `COMPOSE_PROJECT_NAME`을 임의로 바꾸지 않는다.
실패하면 반복 실행하거나 볼륨을 지우지 말고 아래 로그를 확인한다.

## 호스트 Nginx·인증서

- 실제 설정: `/etc/nginx/sites-available/linker` → `sites-enabled/linker`.
- 인증서는 호스트의 Certbot에서 관리한다. Docker에 인증서 복사 불필요.
- 초기 설정 예시: [host-linker.http.conf.example](../../nginx/host-linker.http.conf.example). **현재 Certbot이 적용한 HTTPS 설정을 이 HTTP 예시로 덮어쓰지 않는다.**
- 호스트는 `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`를 직접 설정해야 한다. 기존 설정의 `X-Forwarded-Proto $scheme`을 유지한다.
- 운영 컨테이너는 호스트가 전달한 헤더를 신뢰한다. 3004를 외부에 공개하지 않는다.
- 공용 Nginx의 다른 팀 파일과 기본 설정은 변경하지 않는다.

검사·갱신 테스트(최초 적용 및 인증서 설정 변경 후):

```bash
sudo nginx -t
sudo certbot renew --cert-name linker.newlecture.com --dry-run
systemctl list-timers --all | grep certbot
```

인증서 이름이 다르면 `sudo certbot certificates`로 확인한다. 갱신 테스트 성공과 정기 실행 타이머를 모두 확인한다.

## 자주 쓰는 명령

```bash
cd ~/Linker
# 실행 상태·자원 사용
sudo docker compose -f compose.yml -f compose.prod.yml ps
sudo docker stats --no-stream

# 로그·컨테이너 Nginx 검사
sudo docker compose -f compose.yml -f compose.prod.yml logs --tail=100 proxy web backend
sudo docker compose -f compose.yml -f compose.prod.yml exec proxy nginx -t

# 종료: DB·Redis 볼륨 유지
sudo docker compose -f compose.yml -f compose.prod.yml down
```

운영에서는 항상 두 Compose 파일을 함께 지정한다. 개발용 `compose.dev.yml`, `--watch`, 데이터 삭제 옵션 `down -v`는 사용하지 않는다.

## 다음 작업

1. 이 설정을 서버에 적용하고 HTTPS·포트 제거·자원 사용 확인.
2. 백엔드 구현에 맞춰 BFF 인증·쿠키·API·WebSocket 검증. 현재 `/api/v1/*`는 Spring으로 직접 전달한다.
3. `main` 병합 → 테스트·이미지 빌드 → GHCR → SSH 배포 및 롤백 자동화. 현재 자동 배포는 미연결.
