# 레포 설정 가이드

> Next.js·Spring·PostgreSQL·Redis의 로컬 컨테이너 실행은 [Docker Compose 가이드](./DOCKER.md)를 참고하세요.

> 예상 소요 시간: 20~30분
> 이 폴더 안의 파일들을 **레포 루트에 그대로 복사**한 뒤 아래 순서대로 진행

---

## 0. 파일 배치

```
레포 루트/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── feature.md      # 기능 이슈 템플릿 (feat 라벨 자동)
│   │   ├── bug.md          # 버그 이슈 템플릿 (fix 라벨 자동)
│   │   └── config.yml      # 템플릿 없는 빈 이슈 금지
│   ├── workflows/
│   │   ├── ci.yml          # 프론트/백 빌드 체크
│   │   └── labeler.yml     # PR 라벨 자동 부착
│   └── labeler.yml         # 경로 → 라벨 매핑
├── scripts/
│   └── create-labels.sh    # 라벨 일괄 생성
└── .gitignore              # .env 등 커밋 방지
```

기존 `.gitignore`가 있으면 내용 합쳐서 사용.

복사 후 `feat/repo-setup` 같은 브랜치로 커밋 → dev로 PR → 머지.

---

## 1. 라벨 생성 (3분)

GitHub CLI 필요 (`winget install GitHub.cli` → `gh auth login`)

```bash
bash scripts/create-labels.sh
```

생성되는 라벨
- 범위: `frontend`, `backend`, `docs`
- 종류: `feat`, `fix`, `refactor`, `chore`
- 상태: `in progress`, `review needed`

> **반드시 2번보다 먼저.** 라벨이 없으면 이슈 템플릿·labeler가 라벨을 못 붙임

CLI 없으면 레포 → Issues → Labels → New label 에서 수동 생성

---

## 2. Pull Request 설정 (2분)

**Settings → General → Pull Requests**

- [ ] **Allow merge commits** — 체크 해제 (dev → main도 squash면)
- [x] **Allow squash merging** — 체크
  - Default commit message: **Pull request title** 추천
- [ ] **Allow rebase merging** — 체크 해제
- [x] **Always suggest updating pull request branches** — 체크
- [x] **Automatically delete head branches** — 체크

> dev → main을 merge commit으로 하기로 했으면 Allow merge commits도 켜두고,
> **feat → dev는 squash, dev → main은 merge commit** 으로 팀 규칙 정하기

### Automatically delete head branches 동작
- PR 머지되면 해당 feat 브랜치 원격에서 자동 삭제
- Close만 하면 안 지워짐
- dev(기본 브랜치), main(삭제 금지 룰셋)은 안 지워짐
- 실수로 지워지면 PR 페이지 하단 **Restore branch**로 복구
- 로컬 브랜치는 각자 정리 → 아래 6번 참고

---

## 3. Actions 권한 확인 (1분)

**Settings → Actions → General**

- Actions permissions: **Allow all actions and reusable workflows**
- Workflow permissions: **Read repository contents and packages permissions** (기본값 그대로 OK)

> Organization 레포라 Org 설정에서 Actions가 막혀 있으면 Org 관리자가
> Org Settings → Actions → General 에서 허용해야 함

---

## 4. 필수 상태 체크 걸기 (5분)

1. 0번 PR(설정 파일 올린 PR)에서 CI가 한 번 돌았는지 확인
   (PR 하단에 `ci-result` 체크가 보이면 OK)
2. **Settings → Rules → Rulesets** → 기존 dev/main 룰셋 편집
3. **Require status checks to pass** 체크
   - **Add checks** → `ci-result` 검색해서 추가
   - **Require branches to be up to date before merging** 체크
4. Save

> `frontend`, `backend`, `infrastructure` 잡은 추가하지 말고 **`ci-result` 하나만** 걸 것.
> 프론트만 바꾼 PR에선 backend 잡이 스킵되는데, 그걸 필수로 걸면 머지가 영원히 막힘.
> `ci-result`가 세 검사 결과를 확인하고 실패하거나 취소된 검사가 있으면 막아줌.

---

## 5. .env 관리

- `.env`, `.env.local` 등 실제 값 들어간 파일은 **절대 커밋 금지** (.gitignore로 막혀 있음)
- 키 목록만 담은 `.env.example`은 커밋

```bash
# frontend/.env.example
NEXT_PUBLIC_API_BASE_URL=

# backend/.env.example
DB_URL=
DB_USERNAME=
DB_PASSWORD=
JWT_SECRET=
```

- **실제 값은 파이어캠프에 공유**
- 새 환경변수 추가하면 `.env.example`에 키 추가 + 파이어캠프에 값 공유를 같은 PR 타이밍에

> 실수로 커밋했으면 해당 키는 **무조건 재발급**. 커밋 지워도 히스토리에 남음

---

## 6. 팀원 각자 로컬 설정 (1분)

원격에서 지워진 브랜치 정보 자동 정리

```bash
git config --global fetch.prune true
```

머지된 로컬 브랜치 정리

```bash
git checkout dev
git pull
git branch -d feat/브랜치명
```

---

## 프로젝트 초기 세팅 후 확인할 것

CI는 아래를 전제로 작성됨. 다르면 `.github/workflows/ci.yml` 수정

| 항목 | 현재 설정 | 다르면 |
|---|---|---|
| 프론트 패키지 매니저 | pnpm (`frontend/package.json`의 `packageManager`, `pnpm-lock.yaml`) | pnpm 버전과 lockfile을 함께 갱신 |
| 프론트 스크립트 | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (Turborepo) | package.json scripts 이름 맞추기 |
| Node 버전 | 24 (CI), 로컬 최소 22 (`engines`) | CI의 `node-version`과 package.json의 `engines` 확인 |
| Java 버전 | 21 (Spring Boot 4.1.2) | `build.gradle`의 toolchain과 CI의 `java-version` 함께 수정 |
| 백엔드 테스트 | PostgreSQL 16·Redis 7 서비스와 함께 `./gradlew build`로 실행 | 테스트용 환경변수와 서비스 상태 확인 |
| 인프라 검사 | 기본·개발 Compose 설정 및 Nginx 문법 검사 | 실제 컨테이너 빌드·기능 통합 검증은 별도 수행 |
| 폴더명 | `frontend/`, `backend/` | 다르면 ci.yml, labeler.yml 경로 수정 |

> 프론트/백 폴더가 아직 없어도 CI는 스킵 처리돼서 통과함. 지금 바로 적용해도 OK
