# 자동 배포

대상: `linker@cloud.newlecture.com:22` · 경로: `/home/linker/Linker` · AMD64 서버

```text
main 업데이트 → 전체 CI → GHCR 이미지 업로드 → SSH 서버 배포 → HTTPS 확인
```

코드 추가만으로 설정이 끝나지는 않는다. 아래 서버 권한·SSH 키·GitHub 항목을 준비한 뒤 첫 배포를 실행한다.
배포 중 잠깐 중단될 수 있으며, 블루·그린 무중단 배포는 아직 아니다.

## 1. 서버 준비 (linker 계정)

수동 운영 배포가 정상인 상태에서 확인한다.

```bash
cd ~/Linker
uname -m
sudo docker compose -f compose.yml -f compose.prod.yml ps
command -v docker
```

`uname -m`은 `x86_64`, Docker 경로는 `/usr/bin/docker`를 기준으로 작성했다. 다르면 먼저 설정을 맞춘다.
서버 `.env`·DB 비밀번호·인증서는 기존 파일을 유지한다. GitHub에 DB 비밀번호를 복사할 필요는 없다.

자동 배포는 비밀번호 입력이 불가능하므로 Docker 실행에 한해 비밀번호 없는 sudo를 설정한다.
**Docker 실행 권한은 사실상 서버 관리자 권한이다. 공용 서버 관리자와 이 권한 범위를 확인한 뒤 적용한다.**

```bash
sudo visudo -f /etc/sudoers.d/linker-deploy
```

추가할 한 줄:

```sudoers
linker ALL=(root) NOPASSWD: /usr/bin/docker
```

저장 후 검사:

```bash
sudo visudo -c
sudo -n docker info > /dev/null
```

## 2. 배포용 SSH 키 (개인 PC PowerShell)

기존 파일이 없는 전용 이름으로 생성한다. 이미 파일이 있으면 덮어쓰지 않는다. 자동화 전용 키이므로 passphrase는 Enter로 비운다.

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\linker_actions" -C "linker-github-actions"
Get-Content "$env:USERPROFILE\.ssh\linker_actions.pub"
```

공개 키(`.pub`)를 서버 `linker` 계정의 `~/.ssh/authorized_keys`에 **한 줄 추가**한다. 기존 키를 지우지 않는다.

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

추가하는 공개 키 앞에 `restrict `를 붙여 포트·에이전트 포워딩과 PTY를 제한한다.
예: `restrict ssh-ed25519 AAAA... linker-github-actions`.

개인 PC에서 비밀번호 없이 접속되는지 확인한다.

```powershell
ssh -o BatchMode=yes -i "$env:USERPROFILE\.ssh\linker_actions" linker@cloud.newlecture.com "whoami"
```

`linker`가 출력되어야 한다. 이 키는 Actions→서버 접속용이며 서버→GitHub Deploy Key와는 별개다.

## 3. GitHub 등록

저장소 Settings → Secrets and variables → Actions에서 등록한다.

| 종류 | 이름 | 값 |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | 개인 PC의 `linker_actions` 개인 키 전체 (`BEGIN`·`END` 포함). 채팅·문서·저장소에 붙여넣지 않음 |
| Variable | `DEPLOY_HOST` | `cloud.newlecture.com` |
| Variable | `DEPLOY_PORT` | `22` |
| Variable | `DEPLOY_HOST_KEY` | 아래 명령으로 서버에서 직접 확인한 공개 호스트 키 |
| Variable, 선택 | `NEXT_PUBLIC_IMAGE_HOST` | 기존 웹 빌드의 이미지 호스트 값, 미사용 시 비움 |
| Variable, 선택 | `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 기존 웹 빌드의 공개 Toss `test_` 키, 미사용 시 비움 |

서버에 이미 접속한 터미널에서 공개 호스트 키 확인:

```bash
awk '{print $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

`ssh-ed25519 AAAA...` 한 줄을 등록한다. 개인 키(`/etc/ssh/ssh_host_ed25519_key`)를 열거나 등록하지 않는다.
Actions는 이 공개 키와 일치하는 서버에만 접속한다.

Settings → Environments에 `production`을 만들고 배포 브랜치를 `main`으로 제한한다. 필요하면 검토자를 지정한다.
GHCR 업로드·다운로드는 Actions의 임시 `GITHUB_TOKEN`을 사용하므로 별도 GHCR 토큰은 등록하지 않는다.
조직 정책에서 패키지 생성을 허용해야 하며, 기존 비공개 패키지는 이 저장소에 Actions 접근 권한이 있어야 한다.

## 4. 첫 실행 및 실패 확인

위 준비와 검토를 끝낸 뒤 변경사항을 `dev`→`main`에 병합한다. Actions → **Deploy**에서 진행 상태를 확인한다.
수동 재실행은 Run workflow에서 **main**을 선택한다. 다른 브랜치에서는 배포하지 않는다.

- `test`: PR 여부와 관계없이 프론트·백엔드·인프라 전체 검사.
- `images`: 커밋 SHA 태그로 `ghcr.io/likelion-backendschool-9th/linker-web`·`linker-backend` 생성.
- `deploy`: 설정 묶음을 서버 `releases/{SHA}`에 전송하고 이미지를 받아 실행. 서버 git 인증이나 빌드 불필요.
- DB·Redis는 계속 실행하며 앱 세 서비스만 교체. DB 스키마 변경은 별도 절차 필요.
- 새 앱의 기동·내부 HTTP 검사 실패 시 이전 앱 이미지·설정을 복구하고 Actions는 실패로 표시.
- 외부 HTTPS 검사는 서버 배포 후 별도 검사이며, 실패한다고 서버를 다시 자동 복구하지는 않음.
- 복구는 DB 데이터를 되돌리지 않음. 릴리스·이전 이미지·백업을 자동 삭제하지 않음.

확인:

```bash
sudo docker ps --filter label=com.docker.compose.project=linker
sudo docker stats --no-stream
curl -I https://linker.newlecture.com/
```

자동 배포 이후에는 기존 루트에서 수동 `compose up --build`를 실행하지 않는다. 마지막 릴리스와 설정이 섞일 수 있다.
서버의 활성 설정 경로는 `cat ~/Linker/.deployment-state/active`로 확인한다. 복구까지 실패하면 Actions 로그와 컨테이너 로그를 확인하고 수동 대응한다.
