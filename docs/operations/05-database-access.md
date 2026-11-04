# 팀 공통 서버 DB 접속 (macOS·WSL·Linux)

팀원 모두 서버의 **같은 `linker` DB와 `linker` DB 계정**을 사용한다. DB 도구와 로컬 백엔드에서 함께 사용할 수 있다.
서버 DB 계정·비밀번호·포트는 이 스크립트가 변경하지 않는다. 공유 DB의 테이블·데이터 변경은 팀과 합의한다.

## 최초 준비

필수: macOS 또는 WSL/Linux, Python 3, OpenSSH. 백엔드 실행에는 Java 21과 로컬 Redis가 추가로 필요하다.
명령은 프로젝트 루트에서 실행한다. VS Code에서는 내장 터미널을 사용하며, WSL이면 **WSL 터미널**을 사용한다.
macOS에서 Java 21이 설치돼 있지만 다른 버전이 선택돼 있다면 `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`로 선택한다.

먼저 평소 방식으로 SSH에 접속해 호스트 키와 계정 인증을 확인한다.

```bash
ssh linker@cloud.newlecture.com
```

정상 접속 후 `exit`로 로컬 터미널에 돌아온다. 자동 배포용 `linker_actions` 키는 포워딩이 제한되어 있으므로 사용하지 않는다.
SSH 계정은 DB 계정과 별개다. 공통 SSH 계정 `linker`의 Docker 조회는 비밀번호 없는 sudo가 필요하며 현재 서버에는 설정되어 있다.

개인 설정 파일 준비(기존 파일은 유지):

```bash
if [ ! -e .env.remote-db ]; then
  (umask 077; cp .env.remote-db.example .env.remote-db)
fi
chmod 600 .env.remote-db
nano .env.remote-db
```

`DB_PASSWORD`에 담당자에게 별도로 전달받은 **서버 DB 비밀번호**를 넣는다. 비워두면 백엔드 실행 시 입력받는다.

```dotenv
DB_PASSWORD='서버 DB 비밀번호'
```

이 파일은 Git에서 제외된다. 값은 문자 그대로 읽으며 `$` 변수 확장·명령 실행은 하지 않는다.
기존 Docker용 루트 `.env`와는 별개이며, 서버 `.env`를 복사해 올 필요는 없다.
개인 SSH 키가 필요하면 `SSH_KEY_FILE=~/.ssh/본인키`를 설정한다. 비밀번호·개인 키를 Git·문서·채팅 로그에 넣지 않는다.

## 로컬 Redis 준비 (백엔드 실행 시)

공용 DB에 연결하는 로컬 Spring은 기본적으로 **내 PC의 Redis**를 사용한다. 서버의 Redis는 서버 앱이 사용하며, 이 스크립트로 터널링하지 않는다.
DB 도구만 사용하는 `tunnel` 모드에는 Redis가 필요 없다.

Docker Engine/Desktop을 실행한 뒤 다음 명령을 사용한다.

```bash
DB_PASSWORD=redis-only-placeholder docker compose --env-file /dev/null -f compose.yml up -d --wait redis
DB_PASSWORD=redis-only-placeholder docker compose --env-file /dev/null -f compose.yml exec redis redis-cli ping
```

`PONG`이 나오면 준비됐다. Compose는 Redis만 실행해도 전체 파일의 `DB_PASSWORD`를 검사하므로 위 명령에만 임시 값을 전달한다.
이 명령은 Redis만 실행하며 DB·백엔드를 시작하거나 공용 DB 비밀번호를 바꾸지 않는다. 임시 값을 전역 `export`하지 않는다.
루트 `.env`와 무관하게 실행하도록 `--env-file /dev/null`을 사용하며, `.env.remote-db`를 Compose에 전달하거나 셸에서 `source`할 필요가 없다.

Redis 종료가 필요하면 다른 작업이 사용 중인지 확인한 뒤 해당 서비스만 중지한다. 데이터 볼륨은 유지한다.

```bash
DB_PASSWORD=redis-only-placeholder docker compose --env-file /dev/null -f compose.yml stop redis
```

## 매일 실행: 둘 중 하나 선택

**DB 도구/IDE용 터널만 실행:**

```bash
python3 scripts/remote_db.py tunnel
```

**터널과 로컬 Spring을 한 번에 실행:**

```bash
python3 scripts/remote_db.py backend
```

`backend` 모드는 설정한 Redis에 `PING`을 보내 `PONG`을 확인한 후 SSH·Spring을 시작한다. 실패하면 Redis 실행과 `REDIS_HOST`·`REDIS_PORT`를 확인한다.
검사는 현재 로컬 Compose와 같은 인증 없는 Redis를 대상으로 하며 데이터를 쓰거나 지우지 않는다. 실행 후 Redis의 지속적인 상태 감시를 뜻하지는 않는다.
SSH 연결 전 터널 포트와 백엔드 포트의 사용 여부도 검사한다. 충돌하면 기존 실행을 확인하거나 `.env.remote-db`의 `LOCAL_DB_PORT` / `BACKEND_PORT`를 변경한다. 두 포트는 서로 달라야 한다.

서버 DB의 현재 IP를 자동 조회해 로컬 `127.0.0.1:15432`에 연결한다. DB 컨테이너가 재생성돼도 IP를 직접 바꿀 필요가 없다.
PostgreSQL 응답 확인 후 연결 정보를 표시한다. 실제 비밀번호 인증은 DB 도구 또는 Spring에서 확인한다.
창을 계속 열어두고, 종료는 **Ctrl+C**. 백엔드 모드는 터널이 끊기면 로컬 백엔드도 종료한다.
비밀번호 방식 SSH는 IP 조회와 터널 연결에서 두 번 물을 수 있다. 개인 SSH 키 인증을 설정하면 줄일 수 있다.

이미 수동 터널이나 다른 스크립트가 15432를 사용 중이면 먼저 종료하거나 `.env.remote-db`의 `LOCAL_DB_PORT`를 변경한다.
기존 연결을 잘못 재사용하지 않도록 스크립트는 사용 중인 포트에서 중단한다.
`tunnel`에서 `backend` 모드로 바꿀 때도 기존 터널을 **Ctrl+C**로 먼저 종료한다.

Spring 로그의 `Started BackendApplication`이 기동 완료 기준이다. `> Task :bootRun`만으로 완료를 판단하지 않는다.
이 로그는 업무 API 전체의 완료를 뜻하지 않는다.

## DB 도구 설정

| 항목 | 공통 값 |
| --- | --- |
| 종류 / Host / Port | PostgreSQL / `127.0.0.1` / `15432` (변경 시 개인 설정값) |
| Database / Username | `linker` / `linker` |
| Password | 서버 DB 비밀번호. SSH 로그인 비밀번호·GitHub 토큰과 다름 |
| 도구 자체 SSH Tunnel | 끔. 공통 스크립트의 터널 사용 |

접속 후 SQL 편집기에서 조회한다.

```sql
SELECT current_database(), current_user;
```

둘 다 `linker`면 정상이다. 초기에는 테이블이 없어도 정상이며 생성은 팀의 ERD·마이그레이션 방식에 따른다.
Windows에서 실행하는 DB 도구는 이번 WSL/Linux 스크립트 대상이 아니다. Windows/WSL의 `127.0.0.1`이 같다고 가정하지 않는다.

### VS Code 터미널에서만 사용하는 경우

터널/백엔드 터미널을 유지한 채 **새 터미널**을 연다. `psql` 클라이언트가 설치돼 있다면 다음으로 접속한다.

```bash
psql -h 127.0.0.1 -p 15432 -U linker -d linker -W
```

서버 DB 비밀번호를 입력한다(입력 중 글자가 보이지 않는 것이 정상). 포트를 변경했다면 개인 설정값을 사용한다.
`linker=>` 또는 `linker=#`가 나온 **psql 안에서** SQL을 입력한다. 터널 창이나 일반 셸에서는 SQL을 실행할 수 없다.

```sql
SELECT current_database(), current_user;
```

psql 종료는 `\q`다. 터널/백엔드를 종료하려면 해당 실행 터미널에서 **Ctrl+C**를 누른다.

## 백엔드에 전달되는 설정

스크립트의 `backend` 모드가 환경변수를 전달하므로 Spring 설정 파일 수정은 필요 없다.

| 항목 | 기본값 |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://127.0.0.1:15432/linker` |
| `DB_USERNAME` / `DB_PASSWORD` | 공통 계정 `linker` / 개인 설정 또는 입력한 비밀번호 |
| `REDIS_HOST` / `REDIS_PORT` | 로컬 `127.0.0.1` / `6379` |
| `BACKEND_PORT` → Spring `SERVER_PORT` | `8080` |
| 자동 테이블 생성·SQL 초기화 | `ddl-auto=none`, `spring.sql.init.mode=never`로 실행 |
| Flyway | 기존 Spring 설정 유지. 현재 `enabled=true`로 미적용 마이그레이션 자동 적용 |

스크립트는 `.env.remote-db`를 읽고 같은 이름의 프로세스 환경변수가 있으면 우선한다. 루트 `.env`는 읽지 않는다.
Redis는 자동 실행·종료하지 않는다. 위 로컬 Redis 준비 절차를 사용한다.
IDE에서 직접 Spring을 실행할 때는 `tunnel` 모드를 유지하고 위 DB·Redis 설정과 자동 DDL·SQL 초기화 설정을 IDE에 별도로 지정한다.

공통 값은 [remote-db.json](../../config/remote-db.json), 개인 설정 항목은 [.env.remote-db.example](../../.env.remote-db.example)에 있다.
나중에 팀원별 DB 계정으로 바꾸면 같은 DB를 유지하면서 개인 파일의 `DB_USERNAME`·`DB_PASSWORD`만 변경하면 된다.

### 테이블 생성과 테스트

Hibernate의 자동 테이블 생성·SQL 초기화를 꺼도 **Flyway는 별개**다. `backend` 실행은 기존 `application.yml` 설정에 따라 공용 DB의 미적용 SQL을 적용할 수 있다.
스키마 변경은 팀과 적용 순서를 맞추고 새 Flyway 마이그레이션으로 관리한다. 이미 적용한 `V1__step0_foundation.sql`을 수정하거나 수동으로 테이블을 중복 생성하지 않는다.

Flyway가 적용된 뒤 적용 이력은 psql/DB 도구에서 읽기 조회로 확인한다.

```sql
SELECT version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

이력 테이블 자체가 없다면 아직 초기화 전일 수 있다. 테스트는 공용 DB 대신 격리된 테스트 DB·Redis를 사용한다.
현재 `FoundationIntegrationTest`는 Testcontainers의 PostgreSQL·Redis로 연결을 바꾸고 테스트 데이터를 초기화한다.

## B → A·D 인프라 전달 기준

| 항목 | 공유할 기준 |
| --- | --- |
| 현재 서버 | `cloud.newlecture.com`, SSH 22, 공통 설정은 `config/remote-db.json` |
| 공용 DB | 같은 `linker` DB·계정, 로컬 접속은 SSH 터널 `127.0.0.1:15432` |
| Redis | 로컬 Spring은 로컬 `127.0.0.1:6379`; 서버 앱은 Compose 내부 `redis:6379` |
| 환경변수 | 위 표·`.env.remote-db.example`의 키 사용. 실제 비밀값은 저장소·PR에 쓰지 않고 팀의 기존 비공개 경로로 전달 |
| 리전 / 서버 위치 | **서울** — 강사님 제공 공용 서버(2026-11-04 사용자 확인) |
| 완료 근거 | DB 인증·Redis PONG·Spring 기동·마이그레이션 이력을 구분해 확인하고, A·D 전달 여부도 별도로 기록 |

전달 후 A·D는 각자 PC에서 일반 SSH 인증 → Redis `PONG` → `backend` 모드의 Spring 기동을 확인하고, 새 터미널의 psql/DB 도구에서 DB 계정·마이그레이션 이력을 조회한다.
전달할 때는 이 문서와 환경변수 예시를 사용하고, 한 사람의 PC에서 성공한 결과를 팀원 전원의 접속 확인으로 대신하지 않는다.

기존 서버·자동 배포를 재구축하지 않는다([서버 운영](03-deployment.md), [자동 배포](04-automatic-deployment.md)).
이 안내는 인프라 접속 범위이며 OpenAPI 태그·공통 오류 계약·Sentry 등 0번 미합의 항목을 확정하지 않는다.

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| SSH 인증 실패·처음 접속하는 서버 | 일반 SSH 접속부터 확인. 자동 배포 키는 사용하지 않음 |
| `sudo ... password is required` | 서버 담당자에게 Docker IP 조회 권한 확인 요청 |
| 로컬 포트 사용 중 | 기존 터널 종료 또는 `LOCAL_DB_PORT` 변경 |
| Compose `DB_PASSWORD is required` | 위 Redis 단독 실행 명령 사용. `.env.remote-db`는 Compose가 자동으로 읽지 않음 |
| Redis 연결·PONG 확인 실패 | Docker/Redis 실행과 `REDIS_HOST`·`REDIS_PORT` 확인. 인증이 필요한 Redis나 다른 서비스 포트가 아닌지 확인 |
| PostgreSQL 응답 없음·터널 종료 | 서버 DB 상태·네트워크와 위 SSH 오류 확인 |
| DB 비밀번호 실패 | 서버 DB 비밀번호 확인. `.env` 수정만으로 기존 DB 비밀번호가 바뀌지 않음 |
| 백엔드 8080 충돌 | 기존 백엔드 종료 또는 `BACKEND_PORT` 변경. `LOCAL_DB_PORT`와 같게 지정하지 않음 |
| 호스트 키 변경 경고 | 아래 절차로 서버 확인 후 기존 기록 갱신 |

서버 키가 바뀌었다면 관리자 또는 기존의 신뢰한 서버 접속에서 지문을 확인한다.

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

경고 지문과 실제 서버 지문이 **일치하는 것을 확인한 경우에만**, 오류가 난 로컬 환경에서 실행한다.

```bash
ssh-keygen -R cloud.newlecture.com
```

재접속 질문의 지문도 확인한다. 일치하지 않거나 관리자 확인이 안 되면 중단한다.
