# 서버 운영

기준일: 2026-11-02 · **수동 배포·운영 설정 적용·첫 자동 배포 완료**

## 접속과 구성

| 항목 | 현재 값 |
| --- | --- |
| 서비스 | https://linker.newlecture.com/ |
| SSH | `ssh linker@cloud.newlecture.com` (22번) |
| 서버 경로 | `/home/linker/Linker` |
| 내부 진입점 | `127.0.0.1:3004` |
| 실행 도구 | Docker 29.1.3 / Compose 2.40.3 / Buildx 0.30.1 |

```text
브라우저 HTTPS → 호스트 Nginx :443 → 내부 3004
→ Docker Nginx → Next.js / Spring Boot → PostgreSQL·Redis
```

## 완료한 작업

- `linker` 계정과 서버 `.env` 준비, 다섯 컨테이너 healthy 확인.
- 호스트 Nginx·Certbot 구성, 외부 HTTPS 200 및 브라우저 접속 확인.
- 운영 Compose 적용: 직접 디버깅 포트 제거, 3004만 loopback에 연결.
- 자동 재시작(`unless-stopped`), 서비스별 로그 순환(10MB × 3), CPU·메모리 상한 적용.
- 기존 DB·Redis 볼륨 유지 및 HTTPS 정보 전달 구성.
- **첫 Actions 자동 배포 성공:** [실행 결과](https://github.com/likelion-backendschool-9th/Linker/actions/runs/41412487884), 배포 커밋 `5ac46fb`.

## 앞으로 배포하는 방법

**작업 PR → dev 검증 → dev를 main에 병합 → 자동 배포** 순서다.
서버에서 별도 `git pull`·이미지 빌드·Compose 재실행은 필요 없다.
배포 진행·재실행 방법은 [자동 배포](./04-automatic-deployment.md)를 참고한다.

서버 `.env`·DB 비밀번호·인증서는 그대로 유지한다. `.env`는 `chmod 600 .env`로 보호하고 Git에 올리지 않는다.
앱 이미지는 GHCR에서 받으며, 활성 설정은 `releases/{SHA}`에 보관한다.
기존 루트에서 `compose up --build`를 실행하면 자동 배포된 버전을 덮어쓸 수 있으므로 사용하지 않는다.

## 상태 확인·로그

리눅스 서버에서 실행한다.

```bash
# 실행 상태·활성 배포 경로·자원 사용
sudo docker ps --filter label=com.docker.compose.project=linker
cat ~/Linker/.deployment-state/active
sudo docker stats --no-stream

# 실제 실행 중인 앱 로그
sudo docker logs --tail=100 linker-web-1
sudo docker logs --tail=100 linker-backend-1
sudo docker logs --tail=100 linker-proxy-1

# 외부 HTTPS 응답
curl -I https://linker.newlecture.com/
```

포트 표시에 `3000/tcp`, `8080/tcp`만 있는 것은 내부 포트다. 호스트 연결은 `127.0.0.1:3004->80/tcp`만 유지한다.

## 인증서·DB 관리

개인 PC에서 서버 DB를 조회하려면 [DB 접속 안내](./05-database-access.md)를 따른다.

호스트 Nginx 설정은 `/etc/nginx/sites-available/linker`, 인증서는 호스트 Certbot이 관리한다.
다른 팀의 설정은 변경하지 않는다. [초기 HTTP 예시](../../nginx/host-linker.http.conf.example)로 현재 HTTPS 설정을 덮어쓰지 않는다.

```bash
sudo nginx -t
sudo certbot renew --cert-name linker.newlecture.com --dry-run
systemctl list-timers --all | grep certbot
```

HTTPS 발급·접속은 확인했으며, **갱신 테스트와 타이머 동작은 별도로 확인**한다.
DB 백업이 필요하면 서버 계정 홈에 저장한다.

```bash
install -d -m 700 ~/linker-backups
(umask 077; sudo docker exec linker-db pg_dump -U linker -d linker -Fc > ~/linker-backups/linker-$(date +%Y%m%d-%H%M%S).dump)
```

`down -v`는 데이터를 삭제한다. DB 비밀번호 변경·스키마 변경·복구는 별도 절차로 진행한다.

## 남은 작업

- 실제 로그인·API·WebSocket·결제 기능 연동 검증. 배포 성공이 기능 완성을 의미하지 않는다.
- DB 백업·복구 자동화와 운영 자원 사용량 점검.
- 블루·그린 무중단 배포는 아직 미구현. 현재 교체 중 잠깐 중단될 수 있다.
