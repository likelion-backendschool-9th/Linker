# 팀 공통 서버 DB 접속 (WSL·Linux)

팀원 모두 서버의 **같은 `linker` DB와 `linker` DB 계정**을 사용한다. DB 도구와 로컬 백엔드에서 함께 사용할 수 있다.
서버 DB 계정·비밀번호·포트는 이 스크립트가 변경하지 않는다. 공유 DB의 테이블·데이터 변경은 팀과 합의한다.

## 최초 준비

필수: WSL/Linux, Python 3, OpenSSH. 백엔드 실행에는 Java 21과 필요한 로컬 Redis가 추가로 필요하다.
명령은 프로젝트 루트에서 실행한다. VS Code가 WSL이면 **WSL 터미널**을 사용한다.

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

## 매일 실행: 둘 중 하나 선택

**DB 도구/IDE용 터널만 실행:**

```bash
python3 scripts/remote_db.py tunnel
```

**터널과 로컬 Spring을 한 번에 실행:**

```bash
python3 scripts/remote_db.py backend
```

서버 DB의 현재 IP를 자동 조회해 로컬 `127.0.0.1:15432`에 연결한다. DB 컨테이너가 재생성돼도 IP를 직접 바꿀 필요가 없다.
PostgreSQL 응답 확인 후 연결 정보를 표시한다. 실제 비밀번호 인증은 DB 도구 또는 Spring에서 확인한다.
창을 계속 열어두고, 종료는 **Ctrl+C**. 백엔드 모드는 터널이 끊기면 로컬 백엔드도 종료한다.
비밀번호 방식 SSH는 IP 조회와 터널 연결에서 두 번 물을 수 있다. 개인 SSH 키 인증을 설정하면 줄일 수 있다.

이미 수동 터널이나 다른 스크립트가 15432를 사용 중이면 먼저 종료하거나 `.env.remote-db`의 `LOCAL_DB_PORT`를 변경한다.
기존 연결을 잘못 재사용하지 않도록 스크립트는 사용 중인 포트에서 중단한다.

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

## 백엔드에 전달되는 설정

스크립트의 `backend` 모드가 환경변수를 전달하므로 Spring 설정 파일 수정은 필요 없다.

| 항목 | 기본값 |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://127.0.0.1:15432/linker` |
| `DB_USERNAME` / `DB_PASSWORD` | 공통 계정 `linker` / 개인 설정 또는 입력한 비밀번호 |
| Redis / 백엔드 포트 | 로컬 `127.0.0.1:6379` / `8080` |
| 자동 테이블 생성·SQL 초기화 | `ddl-auto=none`, `spring.sql.init.mode=never`로 실행 |

Redis는 자동 실행하지 않는다. 로컬 Compose 환경을 준비했다면 `docker compose up -d redis`로 실행할 수 있다.
IDE에서 직접 Spring을 실행할 때는 `tunnel` 모드를 유지하고 IDE에 DB 환경변수를 별도로 설정한다.

공통 값은 [remote-db.json](../../config/remote-db.json), 개인 설정 항목은 [.env.remote-db.example](../../.env.remote-db.example)에 있다.
나중에 팀원별 DB 계정으로 바꾸면 같은 DB를 유지하면서 개인 파일의 `DB_USERNAME`·`DB_PASSWORD`만 변경하면 된다.

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| SSH 인증 실패·처음 접속하는 서버 | 일반 SSH 접속부터 확인. 자동 배포 키는 사용하지 않음 |
| `sudo ... password is required` | 서버 담당자에게 Docker IP 조회 권한 확인 요청 |
| 로컬 포트 사용 중 | 기존 터널 종료 또는 `LOCAL_DB_PORT` 변경 |
| PostgreSQL 응답 없음·터널 종료 | 서버 DB 상태·네트워크와 위 SSH 오류 확인 |
| DB 비밀번호 실패 | 서버 DB 비밀번호 확인. `.env` 수정만으로 기존 DB 비밀번호가 바뀌지 않음 |
| 백엔드 8080 충돌 | 기존 백엔드 종료 또는 `BACKEND_PORT` 변경 |
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
