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
→ SSH로 서버 앱 교체 → 내부 상태 검사 → 외부 HTTPS 검사
```

| 항목 | 동작 |
| --- | --- |
| 배포 대상 | `linker@cloud.newlecture.com:22`, `/home/linker/Linker`, AMD64 |
| 앱 이미지 | `ghcr.io/likelion-backendschool-9th/linker-web`·`linker-backend`, 커밋 SHA 태그 |
| 배포 파일 | 서버 `releases/{SHA}`에 보관, 동시 배포 잠금 적용 |
| 교체 서비스 | 웹·백엔드·Docker Nginx. DB·Redis는 계속 실행 |
| 유지하는 설정 | 서버 `.env`, 데이터 볼륨, 호스트 Nginx·인증서 |
| 실패 시 | 새 앱 기동·내부 HTTP 검사 실패 시 이전 앱 이미지·설정으로 복구 |

첫 실행에서 전체 CI·이미지 업로드·SSH 서버 배포·외부 HTTPS 200을 확인했다.
복구 분기는 모의 테스트로 검증했으며, **실제 서버에서 의도적인 장애·복구 훈련은 하지 않았다.**

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

- 교체 중 잠깐 중단될 수 있다. 블루·그린 무중단 배포는 아니다.
- 이미지 다운로드 실패 시 앱 교체를 시작하지 않는다.
- 앱 기동·내부 검사 실패 시 복구를 시도하고 Actions는 실패로 표시한다. 복구까지 실패하면 수동 대응한다.
- 외부 HTTPS 검사 실패는 별도로 표시하며 이 단계에서는 자동 복구하지 않는다.
- DB 데이터·스키마는 자동으로 되돌리지 않는다. 마이그레이션은 별도 검증이 필요하다.
- 이전 릴리스·이미지를 자동 삭제하지 않으므로 디스크 사용량을 주기적으로 확인한다.
