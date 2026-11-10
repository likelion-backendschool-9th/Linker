# 자동 배포

**2026-11-02 첫 자동 배포 성공.** [Actions 실행 결과](https://github.com/likelion-backendschool-9th/Linker/actions/runs/41412487884) · 커밋 `5ac46fb`

## 팀원이 배포할 때

1. 작업 PR을 `dev`에 병합하고 검증한다.
2. 배포할 내용을 `dev → main` PR로 올린다.
3. CI 통과·검토 후 병합한다. 이때 실제 서버 배포가 시작된다.
4. GitHub **Actions → Deploy**의 `test → images → deploy`가 모두 초록색인지 확인한다.
5. https://linker.newlecture.com/ 에서 변경 화면을 확인한다.

**서버는 계속 켜둔다.** 수동 `git pull`·빌드·Compose 재실행은 필요 없다. `dev` 병합만으로는 배포되지 않는다.
재실행은 **Actions → Deploy → Run workflow → main**에서 한다. `dev` 브랜치는 삭제하지 않는다.

## 자동으로 수행되는 작업

```text
main 업데이트 → 프론트·백엔드·인프라 전체 검사
→ 웹·백엔드 이미지 빌드 → GHCR 업로드
→ SSH로 서버 앱 롤링 교체(무중단) → 내부 상태 검사 → 외부 HTTPS 검사
```

| 항목 | 동작 |
| --- | --- |
| 배포 대상 | `linker@cloud.newlecture.com:22`, `/home/linker/Linker`, AMD64 |
| 앱 이미지 | `ghcr.io/likelion-backendschool-9th/linker-web`·`linker-backend`, 커밋 SHA 태그 |
| 배포 파일 | 서버 `releases/{SHA}`에 보관, 동시 배포 잠금 적용 |
| 교체 서비스 | 백엔드 → 웹 순서로 롤링 교체. Docker Nginx는 설정이 바뀐 배포에서만 재생성. DB·Redis는 계속 실행 |
| 유지하는 설정 | 서버 `.env`, 데이터 볼륨, 호스트 Nginx·인증서 |
| 실패 시 | 새 컨테이너가 healthy가 안 되면 그것만 지우고 기존 컨테이너 유지. 일부 교체 후 실패하면 교체한 서비스를 이전 이미지로 같은 방식으로 복구 |

첫 실행에서 전체 CI·이미지 업로드·SSH 서버 배포·외부 HTTPS 200을 확인했다.
복구 분기는 모의 테스트로 검증했으며, **실제 서버에서 의도적인 장애·복구 훈련은 하지 않았다.**

## 무중단 교체 방식

`deploy/apply.sh`는 서비스(백엔드 → 웹)마다 다음을 수행한다.

1. 기존 컨테이너는 그대로 두고 새 이미지 컨테이너 1개를 추가한다(`--scale 서비스=2 --no-recreate`).
2. 새 컨테이너가 healthy가 될 때까지 기다린다(최대 300초). 실패하면 새 컨테이너만 지운다.
3. 12초 기다린다. Docker Nginx는 서비스 이름을 10초마다 다시 조회하므로 이 사이에 새 컨테이너로도 요청을 나눠 보낸다.
4. 기존 컨테이너를 `docker stop --time 40`으로 멈춘다. 백엔드(`server.shutdown: graceful`, 30초)와 웹(Next.js)은 새 연결을 받지 않고 처리 중인 요청을 끝낸 뒤 종료한다.
5. 기존 컨테이너를 삭제한다.

Docker Nginx는 연결 실패를 2초 안에 판단(`proxy_connect_timeout 2s`)하고 남은 컨테이너로 다시 보낸다(기본 `proxy_next_upstream error timeout`).
Docker Nginx는 호스트 포트를 하나만 쓰므로 겹쳐 띄울 수 없다. 서비스 정의(`config --hash`)나 `nginx/production.conf` 내용이 바뀐 배포에서만 마지막에 재생성하며, 이때 1~2초 끊길 수 있다.

2026-11-10 로컬에서 같은 절차를 검증했다. 실제 `production.conf`와 기동 8초짜리 가짜 서버로 교체하는 동안 GET·POST 요청에 502가 없었고, 3초 걸리는 요청도 끝까지 응답했다. 같은 조건에서 기존 재생성 방식은 약 10초 동안 502가 났다. 실제 서버 검증은 이 방식의 첫 배포에서 한다.

교체 중 주의점:

- **새 버전과 이전 버전이 1분 정도 함께 동작한다.** API·DB 변경은 이전 버전과 호환되게 한다. 컬럼 삭제·이름 변경은 "추가 → 다음 배포에서 삭제"처럼 두 번에 나눈다. Flyway 마이그레이션은 새 백엔드가 뜰 때 실행되고, 이전 백엔드는 그 스키마 위에서 계속 동작한다.
- **예약 작업이 잠깐 두 인스턴스에서 돈다.** 분산 잠금(ShedLock)이 없다. GitHub webhook 소비는 Redis 큐라 중복되지 않는다. 60초 주기 푸시 발송은 겹치는 동안 같은 알림을 두 번 보낼 수 있다. 자정 등 cron 작업 시각에는 배포하지 않는다.
- **WebSocket은 재연결된다.** 이전 백엔드가 종료될 때 STOMP 연결이 끊기고 클라이언트가 새 백엔드로 다시 붙는다. 메모리 브로커(`enableSimpleBroker`)라 겹치는 동안 다른 인스턴스에 붙은 사용자에게는 실시간 메시지가 늦게 보일 수 있다(목록 재조회로 복구).
- **메모리가 잠깐 늘어난다.** 교체 중인 서비스의 메모리 한도(백엔드 1g, 웹 768m)만큼 추가로 필요하다.
- **배포가 중간에 끊기면** 한 서비스에 컨테이너가 2개 남을 수 있다. 다음 배포는 `Expected one running ... container`로 멈춘다. 서버에서 `sudo docker ps --filter label=com.docker.compose.project=linker`로 확인하고 오래된 쪽을 `sudo docker stop --time 40 <ID> && sudo docker rm <ID>`로 정리한 뒤 다시 실행한다.
- Docker Nginx는 이전 릴리스 폴더의 `nginx/production.conf`를 마운트하고 있을 수 있다. 사용 중인 릴리스 폴더(`.deployment-state/active`)는 지우지 않는다.

## 등록 완료된 설정

| 위치 | 항목 |
| --- | --- |
| Repository Secret | `DEPLOY_SSH_KEY`: Actions→서버 접속용 개인 키 |
| Repository Variables | `DEPLOY_HOST=cloud.newlecture.com`, `DEPLOY_PORT=22`, `DEPLOY_HOST_KEY` |
| Environment | `production`, 배포 허용 브랜치는 `main`만 |
| 서버 SSH | 배포 공개 키를 `linker`의 `~/.ssh/authorized_keys`에 등록, 키 앞에 `restrict` 적용 |
| 서버 권한 | `/etc/sudoers.d/linker-deploy`에서 `/usr/bin/docker`에 NOPASSWD 허용 |

GitHub 설정 위치는 **Settings → Secrets and variables → Actions**, 환경은 **Settings → Environments**다.
개인 키·토큰·DB 비밀번호는 문서나 저장소에 넣지 않는다. Docker 실행 권한은 사실상 서버 관리자 권한이므로 배포 키 접근을 제한한다.

- GHCR 인증: Actions의 임시 `GITHUB_TOKEN` 사용. 별도 GHCR Secret 불필요.
- 실제 DB 정보: 서버 `.env` 사용. GitHub에 등록하지 않는다.
- 서버 SSH 호스트 키 변경 시: 서버에서 공개 키를 직접 확인한 뒤 `DEPLOY_HOST_KEY` 갱신.
- 웹 빌드 값이 필요하면 `NEXT_PUBLIC_IMAGE_HOST`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`를 GitHub Variables에 등록. 서버 `.env`의 공개 값이 이미지 빌드에 자동 전달되지는 않는다.
- `NEXT_PUBLIC_SITE_URL`은 Variable이 없으면 `https://linker.newlecture.com`으로 빌드한다. 도메인이 바뀔 때만 등록한다.
- 백엔드는 `compose.yml`의 `backend.environment`에 적힌 변수만 받는다. 서버 `.env`에 새 변수를 넣었다면 이 목록에도 있어야 한다.

## 실패했을 때

1. **Actions → 실패한 실행 → 빨간 단계**에서 원인을 확인한다.
2. 서버 로그·응답은 [서버 운영](./03-deployment.md#상태-확인로그)의 명령으로 확인한다.
3. 원인을 수정하고 검증한 뒤 `main`에 반영하거나 해당 실행을 재실행한다.

유의점:

- 앱 교체는 무중단이다. Docker Nginx 설정이 바뀐 배포만 1~2초 끊길 수 있다.
- 이미지 다운로드 실패 시 앱 교체를 시작하지 않는다.
- 새 컨테이너가 기동에 실패하면 기존 컨테이너가 계속 서비스한다. 교체 후 내부 검사가 실패하면 이전 이미지로 롤링 복구한다. 어느 경우든 Actions는 실패로 표시하고, 복구까지 실패하면 수동 대응한다.
- 외부 HTTPS 검사 실패는 별도로 표시하며 이 단계에서는 자동 복구하지 않는다.
- DB 데이터·스키마는 자동으로 되돌리지 않는다. 마이그레이션은 별도 검증이 필요하다.
- 이전 릴리스·이미지를 자동 삭제하지 않으므로 디스크 사용량을 주기적으로 확인한다.
