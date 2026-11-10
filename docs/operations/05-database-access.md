# 로컬 개발 DB

개발 DB는 각자 PC의 Docker Compose가 실행하는 PostgreSQL이다. 팀 공용 원격 DB나 SSH 터널은 사용하지 않는다.

- Docker 안의 백엔드는 `db:5432`로 접속한다.
- PC의 DB 도구는 `127.0.0.1:5500`으로 접속한다. 둘은 같은 로컬 DB다.
- 운영 서버의 DB와 데이터는 이 절차로 바꾸지 않는다. 원격 데이터는 로컬로 복사되지 않는다.

화면만 목업으로 볼 때는 DB가 필요 없다. 루트 [README](../../README.md)의 `pnpm dev:mock`을 사용한다.

## 준비

루트 `.env`는 개인 설정이며 Git에 올리지 않는다. 없으면 `.env.example`을 복사하고, 이미 있으면 덮어쓰지 않는다.

```bash
if [ ! -e .env ]; then
  (umask 077; cp -n .env.example .env)
fi
```

Compose는 `DB_PASSWORD`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`가 있어야 한다. JWT는 로컬에서 만든 RSA 키 쌍이다. 배포 서버 키를 가져오지 않고, 값은 `.env`에만 둔다. 개인 키는 Git·채팅·문서에 넣지 않는다.

설정 검사만 할 때는 비밀값이 출력되지 않는 명령을 사용한다.

```bash
docker compose config --quiet
```

## JWT 키 생성·설정 (처음 한 번)

JWT는 로그인 상태를 증명하는 토큰이다. 백엔드는 개인 키로 서명하고, 백엔드·프론트 서버는 공개 키로 검증한다. 토큰은 httpOnly 쿠키에 보관하며 JavaScript나 앱 브릿지에 전달하지 않는다.

키는 외부 발급이 아니라 각자 로컬에서 생성한다. 자기 백엔드·프론트 서버는 같은 키 쌍을 사용한다. GitHub App 키와 별개다. DB·Redis 자체에는 필요 없지만 현재 Compose 설정 검사에서 요구한다. 아래 명령은 OpenSSL·Python 3가 있는 WSL·Linux에서 실행한다.

### 1. 키 생성 — WSL·Linux 터미널

아래 명령은 프로젝트 루트에서 실행한다. **기존 키가 있으면 중단**하므로 실수로 교체하지 않는다.

```bash
mkdir -p .local-notes/keys
chmod 700 .local-notes/keys

(
  set -eu
  umask 077
  if [ -e .local-notes/keys/jwt-private.pem ] || [ -e .local-notes/keys/jwt-public.pem ]; then
    echo "기존 키가 있습니다. 새로 생성하지 않습니다."
    exit 1
  fi
  openssl genpkey -algorithm RSA \
    -pkeyopt rsa_keygen_bits:2048 \
    -out .local-notes/keys/jwt-private.pem
  openssl pkey \
    -in .local-notes/keys/jwt-private.pem \
    -pubout \
    -out .local-notes/keys/jwt-public.pem
)
```

### 2. 루트 .env에 설정 — 같은 터미널

`python3`부터 마지막 `PY`까지 **통째로 붙여넣어 실행**한다. 기존 `.env`의 다른 설정은 유지하고 JWT 항목만 갱신한다. 기존 JWT 값이 있다면 교체되므로 같은 로컬 키를 적용하려는지 확인한다.

```bash
python3 - <<'PY'
from pathlib import Path
import re

env = Path('.env')
if not env.exists():
    raise SystemExit('먼저 .env.example을 .env로 복사하고 개인 설정을 입력하세요.')

text = env.read_text()
for name, filename in [
    ('JWT_PRIVATE_KEY', 'jwt-private.pem'),
    ('JWT_PUBLIC_KEY', 'jwt-public.pem'),
]:
    value = Path('.local-notes/keys', filename).read_text().strip()
    line = name + "='" + value.replace('\n', '\\n') + "'"
    pattern = rf'(?m)^(?:export\s+)?{name}\s*=.*$'
    if re.search(pattern, text):
        text = re.sub(pattern, lambda _: line, text)
    else:
        text = text.rstrip() + '\n' + line + '\n'

env.chmod(0o600)
env.write_text(text)
print('JWT 키를 .env에 설정했습니다. 키 값은 출력하지 않습니다.')
PY
```

### 3. 설정 확인

```bash
docker compose config --quiet
```

오류 없이 끝나면 Compose 설정 검사 통과다. **로그인 동작 검증은 별도**다. 이후 컨테이너를 생성·재생성할 때 설정이 적용된다.

키를 교체하면 이전 토큰은 검증되지 않아 다시 로그인해야 한다. 개인 키·`.env`는 Git·채팅에 올리지 않는다. IDE나 `./gradlew bootRun`은 루트 `.env`를 자동으로 읽지 않으므로 별도 환경변수 전달이 필요하다.

## 실행

프로젝트 루트에서 실행한다. 기본 실행은 빌드된 웹·백엔드·DB·Redis·Nginx를 함께 띄운다.

```bash
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

브라우저 주소는 http://localhost:8000 이다.

프론트 소스를 저장할 때 바로 반영하려면 개발 구성을 함께 쓴다. 기본 실행과 동시에 켜지 않는다. 상세는 [Docker 실행](02-docker.md)을 본다.

```bash
docker compose -f compose.yml -f compose.dev.yml up --build --watch
```

백엔드 소스를 반영할 때는 백엔드만 다시 빌드한다.

```bash
docker compose up -d --build backend
```

컨테이너만 종료한다. DB·Redis 데이터는 볼륨에 남는다.

```bash
docker compose down
```

`docker compose down -v`는 DB·Redis 데이터 볼륨을 삭제한다. 비밀번호를 맞추거나 초기화하려는 이유로 사용하지 않는다.

## DB 도구

Compose가 실행 중일 때 접속한다.

| 항목 | 값 |
| --- | --- |
| 종류 / Host / Port | PostgreSQL / `127.0.0.1` / `5500` |
| Database / Username | `linker` / `linker` |
| Password | 루트 `.env`의 `DB_PASSWORD` |

컨테이너 안에서 관리 접속한다. 이 접속은 비밀번호를 묻지 않는다.

```bash
docker compose exec db psql -U linker -d linker
```

```sql
SELECT current_database(), current_user;
SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

`current_database()`와 `current_user`가 `linker`면 접속된 것이다. Flyway 이력 표가 없으면 백엔드가 아직 마이그레이션을 적용하지 않은 상태다. 이미 적용한 `V1__step0_foundation.sql`은 수정하지 않고, 스키마 변경은 새 마이그레이션으로 추가한다.

## 비밀번호와 데이터

PostgreSQL은 볼륨을 처음 만들 때만 `DB_PASSWORD`로 계정을 만든다. 그 다음 `.env`의 비밀번호를 바꿔도 기존 볼륨의 계정 비밀번호는 바뀌지 않는다.

비밀번호 인증이 실패하면 볼륨을 지우지 않는다. 관리 접속 안에서 계정 비밀번호를 `.env`의 `DB_PASSWORD`와 같게 맞춘다.

```text
\password linker
```

psql에서 두 번 입력한 뒤 `\q`로 나오고, 서비스를 다시 확인한다.

```bash
docker compose up -d --wait --wait-timeout 240
docker compose ps
```

호스트에 같은 이름의 환경변수가 있으면 `.env`보다 우선할 수 있다. `docker compose config`의 전체 출력은 비밀값이 포함되므로 공유하지 않는다.
