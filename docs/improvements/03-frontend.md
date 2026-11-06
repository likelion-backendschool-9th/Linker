# 3단계: 프론트엔드 정리

상태: 시작 전 (2단계와 파일이 겹치지 않아 병행 가능, E의 컴포넌트 분리는 먼저 끝내거나 시점 조율)

대상 독자: 프론트 담당 한 명(한 사람이 한 PR 또는 소수의 PR로 진행). 2단계(백엔드)와 파일이 겹치지 않아 동시에 진행할 수 있다.
기준: 1단계 PR #244, CI 규칙 PR #245가 `dev`에 머지된 상태.

> 수치는 2026-11-06 `dev` 기준 조사값이다. 작업 전에 다시 센다.

## 1. 원래 계획 (초기 계획)
- 컴포넌트 파일명을 PascalCase로 일괄 변경. 모든 사람의 파일을 건드리므로 1단계처럼 한 번에 한다.
- `pnpm lint` 경고를 0개로 정리
- 프론트 요청 URL과 WBS 대조(어긋나는 곳 수정)
- `frontend/AGENTS.md`, `03-frontend-blueprint` 규칙 갱신 (0단계에서는 일부러 건드리지 않았다)

## 2. 현재 상태 (조사 결과)

| 항목 | 현재 |
| --- | --- |
| 파일 이름 규칙 | `frontend/AGENTS.md`와 blueprint 101행: "kebab-case 파일 이름, PascalCase로 export하는 컴포넌트, 파일당 컴포넌트 1개" |
| `.tsx` 파일 | 323개, 모두 소문자로 시작(kebab-case) |
| 프레임워크 예약 파일 | `page/layout/loading/error/not-found/template.tsx`, `route.ts` 등 89개. 이름을 바꿀 수 없다 |
| 이름 변경 후보 | 약 234개(`.tsx` 중 예약 파일 제외), `.ts` 포함 시 더 많다. `.ts` 전체는 267개 |
| lint | 오류 0, **경고 6개** (미사용 변수 5개, `<img>` 사용 1개) |
| API 클라이언트 | orval이 `/v3/api-docs`에서 `@Tag`별 파일을 생성한다(`packages/api`). |
| 백엔드 영향 | 1단계/2단계는 URL, `@Tag`, `operationId`를 바꾸지 않는다. 생성 클라이언트에 영향이 없다 |

경고 6개 위치
- `app/(public)/u/[login]/_components/contribution-calendar.tsx` : 미사용 `ContributionResponse`
- `app/(public)/u/[login]/_components/profile-posts.test.tsx` : `<img>` 사용
- `lib/api/api-fetch.test.ts` : 미사용 `_input`, `_init` 4개

## 3. 먼저 정해야 할 것 (원래 노트가 모호한 부분)

원래 계획 이미지가 "컴포넌트 파일명 PascalCase 일괄 변경"이라고 명시한다. 따라서 아래 **A안이 원래 의도**로 보인다. 다만 현재 규칙(kebab-case 파일명, blueprint 101행)과 충돌하므로 규칙 문서를 같이 고쳐야 하고, 훅·유틸 파일(B안)까지 포함할지는 정하지 않았다.

| 선택 | 내용 | 영향 |
| --- | --- | --- |
| A. 컴포넌트 파일을 PascalCase로 | `contribution-calendar.tsx` → `ContributionCalendar.tsx`. 훅·유틸·`page` 등은 그대로 | 이름 변경 약 200개 이상, import 전부 수정 |
| B. 파일 전체 PascalCase | 훅(`use-xxx`), 유틸(`api-fetch.ts`)까지 변경 | 대규모. Next 예약 파일은 예외 |
| C. 현재 규칙 유지 | kebab-case 그대로, 변경 없음 | 작업 없음 |
| 제안 | **A안으로 확정**하고(훅·유틸은 kebab-case 유지) 규칙 문서를 같이 고친다. B안 여부는 팀 확인 | |

주의: 대소문자만 바뀌는 이름 변경은 Windows/macOS의 대소문자 비구분 파일시스템과 git이 꼬이기 쉽다.
- `git mv a.tsx a.tsx.tmp && git mv a.tsx.tmp A.tsx`처럼 두 단계로 바꾸거나 `git mv -f`를 쓴다.
- 팀원이 Windows/macOS를 쓰면 `git config core.ignorecase false`를 확인한다.
- Linux CI에서는 대소문자가 다른 import가 컴파일 오류가 된다. PR CI로 반드시 확인한다.

## 4. 작업 목록

1. **규칙 확정과 문서 갱신** (맨 처음)
   - `frontend/AGENTS.md`, `docs/development/03-frontend-blueprint.md`의 파일 이름 규칙을 확정안으로 고친다.
   - 백엔드 쪽 변경 반영: 컨트롤러 이름 표기(`user.TeamController` 형식, 1단계에서 치환 완료), 접두어 제거 규칙.
   - `docs/`는 한국어 원본의 번역본이다. 바꾼 문서 목록을 PR 본문에 적어 원본 갱신자에게 알린다.
2. **파일 이름 일괄 변경** (A안 기준)
   - 스크립트로 이름을 바꾸고 import를 일괄 치환한다. 손으로 하지 않는다.
   - 테스트(`*.test.tsx`)와 CSS Module(`*.module.css`) 이름이 컴포넌트와 짝을 이루는지 확인한다.
   - 이름 변경만 하는 PR로 분리해서 리뷰하기 쉽게 한다(동작 변경 없음).
3. **lint 0 만들기**
   - 경고 6개 제거. 경고가 CI를 막지는 않지만 `--max-warnings 0`을 걸어 0을 유지하게 한다.
   - `<img>` 경고는 테스트 파일이다. 규칙(`next/image`, 사용자 마크다운 외부 이미지 예외)에 맞게 정리하거나 사유가 있는 곳에만 disable 주석을 단다.
4. **URL·WBS 대조**
   - `docs/planning/07-page-todo.md`(페이지·URL)와 `docs/development/02-wbs.md`(컨트롤러·엔드포인트)를 코드와 대조한다.
   - 확인 항목: 라우트 그룹(`(auth)`, `(public)`, `(member)`, `(developer)`, `(recruiter)`, `(admin)`)과 페이지 번호, 접근 권한(`route-access.ts`), orval 태그(`pNN-…`)와 백엔드 `@Tag`.
   - 불일치를 목록으로 만들고, 문서 오류인지 코드 오류인지 판단해 고친다.
5. **생성 API 클라이언트 확인**
   - 백엔드 최신 `dev`를 띄워 `pnpm generate`를 실행하고 변경 파일이 없는지(또는 의도한 것만 있는지) 확인한다.
   - 변화가 있으면 백엔드 변경 때문인지 확인하고 보고한다. 생성 결과를 손으로 고치지 않는다.
6. **마무리 점검**
   - `pnpm lint`(경고 0), `pnpm typecheck`, `pnpm test`, `pnpm build`가 모두 통과해야 한다(CI `frontend` 잡과 같다).
   - blueprint ch. 14 체크리스트를 따른다.

## 5. 지켜야 할 규칙

- `frontend/AGENTS.md`의 구조·접근성·스타일 규칙을 바꾸는 작업이 아니다. **이름과 lint만** 정리한다. 동작이나 디자인 변경을 섞지 않는다.
- 생성된 API 코드(`packages/api` 출력)를 손으로 고치지 않는다.
- 컴포넌트·페이지에서 목업(`src/mocks`, `USE_MOCKS`)을 참조하지 않는다(규칙 유지).
- 브랜치 `chore/<설명>`, 커밋·PR 제목 `chore: …` 한국어. 이름 변경과 규칙 문서 갱신은 커밋을 나눈다. 에이전트 표시 금지. CI `pr-rules`가 검사한다.
- 같은 파일을 다른 팀원이 작업 중이면 충돌한다. 일괄 변경 전에 팀에 알리고, 열린 프론트 PR이 정리된 시점에 한 번에 진행한다.

## 6. 체크리스트

- [ ] 파일 이름 규칙(A안 확정 여부 B안 포함 여부) 확정, 규칙 문서 갱신
- [ ] E의 `comment-menu-sheet` 등 컴포넌트 분리(2단계)가 끝났거나 시점 조율됨
- [ ] 열린 프론트 PR 확인 및 변경 시점 공지
- [ ] 파일 이름 일괄 변경, import 치환, 대소문자 이름 변경 안전 처리
- [ ] 경고 6개 제거, 경고 0 유지 설정
- [ ] URL·WBS·orval 태그 대조 결과 정리
- [ ] `pnpm generate` 결과 확인
- [ ] `pnpm lint`/`typecheck`/`test`/`build` 통과
- [ ] 바꾼 문서 목록 PR 본문에 기록
