# 00 인프라 접속 기록

> 2026-11-05. 이슈 [#198](https://github.com/likelion-backendschool-9th/Linker/issues/198). A PC에서 [팀 공통 서버 DB 접속](../../operations/05-database-access.md) 기준으로 확인했다.  
> 새 호스트는 고르지 않는다. 서버는 기존 서울 공용 서버 `cloud.newlecture.com`이다.  
> 이 PC의 결과로 D의 접속 확인을 대신하지 않는다. 비밀번호와 개인 키는 적지 않는다.

## 확인

| 항목 | 결과 |
| --- | --- |
| Redis `PONG` | 확인. 프로젝트 루트에서 Redis만 실행했고 `redis-cli ping`이 `PONG`이었다. 볼륨은 유지한다. |
| SSH | 실패. Windows OpenSSH와 WSL 모두 배치 모드에서 `Permission denied (publickey,password)`. WSL `~/.ssh`에 공개 키가 없다. |
| Spring `backend` 모드 | 실행하지 않음. SSH와 `.env.remote-db`의 `DB_PASSWORD`가 없다. |
| Flyway `V1` 이력 | 조회하지 않음. 터널과 DB 인증 전이다. |
| D 접속 확인 | 없음. |

`.env.remote-db` 파일은 이 저장소에 없다. 예시는 `.env.remote-db.example`이다.

## 이어서 할 일

1. 일반 SSH로 `ssh linker@cloud.newlecture.com`에 한 번 접속해 호스트 키와 계정을 확인한다. 자동 배포 키는 쓰지 않는다.
2. `.env.remote-db`에 전달받은 DB 비밀번호만 넣는다. Git에 올리지 않는다.
3. 로컬 Redis가 `PONG`인 상태에서 WSL 또는 macOS/Linux로 `python3 scripts/remote_db.py backend`를 실행하고, 로그의 `Started BackendApplication`을 확인한다.
4. 다른 터미널에서 `flyway_schema_history`를 읽어 `V1` / `step0 foundation` / `success`를 기록한다.
5. D도 같은 순서를 자신의 PC에서 확인하고 이 문서에 따로 적는다.
