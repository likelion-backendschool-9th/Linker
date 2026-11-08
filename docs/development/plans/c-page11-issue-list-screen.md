# C11 이슈 목록 화면 — 작업 기록

> 2026-11-08 · `feat/issue-list-screen` · API 기록은 [c-page11-implementation.md](c-page11-implementation.md)

## 범위

- `/teams/[id]/issues` 화면을 Figma 11(`197:66`, 검색 포커스 `368:1716`, 팀 변경 `368:1891`)에 맞춘다.
- 팀 머리글(`TeamFrame`·`TeamNav`·`TeamSwitcher`)은 11–15와 B의 09가 함께 쓴다.
- 07의 이슈 행과 팀 변경 시트를 11과 공유하도록 `(developer)/_components/`로 옮겼다(`IssueSummaryRow`, `TeamChangeSheet`). 07 화면 모양·동작은 바꾸지 않는다.
- 엔드포인트·테이블·페이지 수는 그대로다(205 REST, 69 테이블). 기존 이슈 목록 API에 선택 파라미터 `q`만 더했다.
- 기준: 모양·문구는 Figma 우선, 기능·권한·API 계약은 문서 우선(07과 같음).

## 확정한 결정 (사용자 결정, 2026-11-08)

| 항목 | 결정 |
| --- | --- |
| 진행 영역 | "전체 이슈 N개" + 상태 카드 4개(완료·진행·정지·작업 전)는 **모든 팀**에 표시. 카드 숫자는 이슈 목록 API의 상태별 `total`로 센다. "최근 추이 근 2주" 그래프는 **Flex 팀만**(`/progress?days=14`). Free 팀은 진행 현황 API를 부르지 않는다 |
| 검색 | 백엔드 이슈 목록 API에 `q`(제목 일부, 대소문자 무시) 추가. URL `?q=`, 입력 후 300ms 또는 Enter로 적용. 최대 100자(`ISSUE.searchMaxLength`, 백엔드 `IssueListQuery.MAX_QUERY_LENGTH`). `일정 없음`에서 검색하면 전체 목록으로 돌아간다 |
| 검색어 100자 | **Policy에 POL-I-6 새로 추가, 준호님 확인 필요, 한국어 원본 반영 필요.** 값은 그대로 두기로 했다(사용자 결정, 2026-11-08) |
| 상태 칩 | Figma대로 전체·작업 전·진행·정지·완료(개수 포함). 칩 개수는 다른 필터·검색을 따르고 자기 상태는 따르지 않는다 |
| 일정 없음 | **11 화면은 Figma대로 '일정 없음' 칩 제거, 목록은 15 링크로만 진입, 준호님 확인 필요.** `?view=unscheduled` 목록과 그 안의 "프로젝트에 추가"(쓰기 권한이 있을 때만)는 남겼고, 15 캘린더의 "이슈 목록의 '일정 없음'에서 보기" 링크로만 들어간다. 이 목록에서는 눌린 상태 칩이 없고, 상태 칩이나 검색을 쓰면 전체 목록으로 돌아간다. Page TODO 11("일정 없음" 탭)·POL-I-3과 다르지만 Policy·TODO, 15·12 화면은 수정하지 않았다(사용자 결정, 2026-11-08) |
| 추이 곡선 | Figma처럼 부드러운 곡선을 유지하되 monotone 3차 곡선(Fritsch–Carlson, d3 `curveMonotoneX`와 같은 방식)으로 바꿨다. 곡선이 이웃한 두 날의 값 밖으로 나가지 않아 0 아래나 최댓값 위로 튀지 않는다(`trend-path.ts`, `trend-path.test.ts`) |
| 추이 제목 | "최근 추이 근 2주" 유지. Figma는 "근 한 달"이지만 Policy POL-T-7이 14일(`ISSUE.progressDays`)이라 문서를 따른다 |
| 뒤로 아이콘 | Figma 11 머리글의 뒤로 아이콘 레이어는 `lucide/arrow-left`(←)지만, 공용 `BackButton`(`ChevronLeft`, '<')을 바꿔야 해서 이번에는 바꾸지 않았다(사용자 결정, 2026-11-08). Solar 대응 아이콘은 `linear/arrow-left` |
| 새로 고침 | 당겨서 새로 고침(1분 1회). 키보드·화면 낭독기용 "새로 고침" 버튼은 포커스될 때만 보인다 |
| 다음 페이지 | Figma에 "더 보기"가 없어 목록 끝이 보이면 자동으로 불러온다 |
| 팀 머리글 | `TeamFrame`을 Figma대로: 뒤로 + 팀 이름(누르면 "팀 변경" 시트) + 페이지 동작(11은 필터 아이콘), 밑줄형 팀 탭(48px), 팀 채팅 바로가기 버튼. h1은 화면 낭독기에 "팀 이름, 이슈(, 팀 상태)"로 읽힌다 |
| 공용 머리글 | `StackHeader`·`PageFrame`에 선택 prop `titleContent` 추가. 넘기지 않으면 기존처럼 `title`을 그대로 쓴다 |
| 팀 변경 시트 | 07과 같은 `TeamChangeSheet`(라디오 초안 + 버튼으로 적용). 현재 팀을 다시 고르면 지금 URL 유지, 다른 팀은 그 팀의 11로 이동 |
| 시트 버튼 문구 | 일단 **"팀 변경"**. **확인 필요:** Figma 11 팀 변경(`368:1891`)의 버튼 문구가 '공유'인지 '팀 변경'인지 프론트 담당(준호님)에게 확인 중이며, 답이 오기 전까지 바꾸지 않는다 |
| Free 팀 안내 | Policy POL-T-7·Page TODO 11은 Free 팀에 카드 자리에 "Flex 알아보기"/"오너에게 요청"을 두라고 하지만, Figma에 없고 상태 카드를 모든 팀에 보여 주기로 해서 안내를 두지 않았다. Policy·TODO는 수정하지 않았다 |
| 대비 낮은 색 | Figma 값 유지: 팀 탭 `#98a3b4` 2.55:1, 검색 안내 문구 `#a3a3a8` 2.48:1(`#f3f4f6` 위), 진행 `#007be6` 4.37:1, 정지 `#e62e00` 4.42:1. 디자인 가이드 §1-3에 기록 |
| 그림자 | 팀 채팅 바로가기 `--shadow-fab`(Figma 값)을 디자인 가이드 4장 예외로 기록 |

새 토큰은 `styles/tokens/color.css`·`layout.css`와 디자인 가이드 1-1·1-2·3-4에 추가했다. 기존 토큰 값은 바꾸지 않았다.

## B 리뷰 필요

1. **09 팀 설정 머리글:** `TeamFrame`·`TeamNav`를 Figma 11대로 바꿔서 09도 같은 머리글(밑줄 탭, 채팅 바로가기, 팀 이름 버튼)이 된다.
2. **B e2e 선택자 수정:** `b-frontend-ui.spec.ts`, `b-team-switcher.spec.ts`에서 "팀 전환" → "팀 변경", 현재 팀 버튼·다른 팀 링크 → 라디오 선택 + "팀 변경" 버튼으로 **선택자만** 바꿨다. 검사 내용(URL 유지, 포커스 복귀, 뒤로 가기, axe, 가로 스크롤)은 그대로다.
3. **B e2e 실패(검사를 바꾸지 않았기 때문):**
   - `b-team-switcher.spec.ts` "PR 29 header trigger…": axe `color-contrast` 위반. 팀 탭 `#98a3b4`(Figma 11 값) 때문이다. 검사를 완화할지, 탭 색을 바꿀지 B와 정해야 한다.
   - `b-frontend-ui.spec.ts` "B screens retain landmarks…": `/workspace`의 07 이슈 메타 `#98a3b4`(07에서 이미 Figma 값으로 정한 색) axe 위반.
   - `b-frontend-ui.spec.ts`의 운영자 회원 상세·감사 로그·채팅 PR 시트 3개: **원래 있던 실패.** `origin/dev`(`3f69578`)를 별도 worktree에서 `pnpm dev:mock`으로 띄워 같은 테스트를 돌렸을 때도 같은 오류로 실패했다(`한서준` 버튼 없음, `table` 없음, `PR 목록` 버튼 없음). 같은 실행에서 `/workspace` axe 실패도 dev에서 똑같이 났다.
   - `b-team-switcher.spec.ts`를 dev에서 돌리는 확인은 실행이 멈춰 결과를 얻지 못했다. 이 실패가 이번 탭 색 때문이라는 것은 axe 결과(팀 탭 노드)로만 판단했다.

## 문서 변경

- Policy 7장: **POL-I-6 Issue search (11)** 신설(제목 일부·대소문자 무시·최대 100자·URL `q`·일정 없음에는 검색 없음). Policy에 POL-I-6 새로 추가, 준호님 확인 필요, 한국어 원본 반영 필요.
- WBS §4-8: `GET /teams/{teamId}/issues` 필터에 `q` 추가(커서는 필터·`q`에 묶임). 엔드포인트 수 변화 없음.
- Page TODO 11: 제목 검색·상태 칩 항목 추가.
- 디자인 가이드: 11 토큰·대비 표·그림자 예외. `--color-status-overdue` 설명을 지금 화면(07·11 날짜만 빨강, "마감 지남" 문구 없음)에 맞게 고쳤다(토큰 파일 주석도 같이).
- 위 문서는 저장소 밖 한국어 원본에도 반영이 필요하다.

## 검증 (로컬, 2026-11-08)

- 백엔드 테스트 추가: `IssueListQueryTest`(검색어 다듬기·100자 제한), `IssueReadIntegrationTest.titleSearchMatchesPartOfTitleAndEscapesWildcards`(부분 일치, `%` 이스케이프, 빈 검색, 101자 400, 검색어가 다른 커서 거절).
  - **통과 (2026-11-08, JDK 21 `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`, Docker WSL 연동 켬, 한 클래스씩 `--rerun`):** `IssueListQueryTest` 2개 통과, `IssueReadIntegrationTest` 109개 통과(실패·오류·생략 0, 새 검색 테스트 포함). 백엔드 전체 테스트를 실행한 것은 아니다.
- 웹 전체(frontend 루트): `pnpm lint` 오류 0(경고 6개는 이번 변경과 무관한 파일), `pnpm typecheck` 통과, `pnpm test` 통과(web 122개 파일 541개, bridge 23개, mobile 33개), `pnpm build` 통과(배포 빌드에 목업 코드 없음).
- 백엔드 `./gradlew build`(JDK 21): **백엔드 전체 빌드는 로컬 미완료, 전체 실행 중 page12 테스트 TRUNCATE deadlock 1건(클래스 단독 실행은 109개 통과), CI 확인 필요.** `bootJar`까지는 통과했다.
- e2e(`pnpm dev:mock`): `c-issue-list.spec.ts` 7개 통과(360·375·600px 가로 스크롤 없음, axe는 Figma 대비 예외만). B e2e 결과는 위 "B 리뷰 필요" 참고.
- 생성 API 타입: 위 통합 테스트가 만든 Springdoc 출력(`backend/build/openapi/page11.json`)을 `p00-common`·`p11-issue-list`로 좁혀 `pnpm generate`와 같은 Orval 설정으로 임시 폴더에 다시 생성해 비교했다. `openAPIDefinition.schemas.ts`의 해당 타입 41개, `p11-issue-list`·`p00-common`의 `.ts`·`.zod.ts`·`.msw.ts` 내용이 지금 파일과 같다(`q` 포함). 차이는 파일 안의 함수·목업 핸들러 순서뿐이라 저장소 파일은 바꾸지 않았다.
  - 주의: `orval.config.ts`는 `clean: true`라서 c-page11-implementation.md의 "생성 재현" 명령을 그대로 실행하면 `src/generated`의 다른 페이지(p01–p33) 생성 파일이 지워진다. 이번 비교는 저장소 밖 임시 폴더로 출력했다.
- 화면 수정 후 다시 확인(추이 곡선, '일정 없음' 칩 제거):
  - Vitest `app/(developer)` 23개 파일 135개 통과(`--maxWorkers=2`: 기본 설정은 메모리 부족으로 진행이 멈춰서 작업자 수를 줄였다). 새 `trend-path.test.ts`는 곡선이 각 구간의 두 값 사이에 머무는지 확인한다.
  - frontend `pnpm lint` 오류 0(경고 6개는 이번 변경과 무관), `pnpm typecheck` 통과.
  - e2e `c-issue-list.spec.ts` 8개 통과(띄워 둔 3000번 `dev:mock` 서버 사용, 15 캘린더 링크 → `?view=unscheduled` → "프로젝트에 추가" 확인 추가).
  - 화면 수정 뒤 `pnpm test` 전체와 `pnpm build`는 다시 돌리지 않았다.
- 푸시하지 않았다.

## PR 리뷰 항목 (PR 본문에 옮길 내용)

- [ ] **Policy에 POL-I-6 새로 추가, 준호님 확인 필요, 한국어 원본 반영 필요** (검색어 최대 100자)
- [ ] 시트 버튼 문구 '팀 변경' vs '공유': 준호님 확인 필요
- [ ] B 리뷰: 09 팀 설정 머리글이 Figma 11 머리글로 바뀜
- [ ] B 리뷰: B e2e 두 파일 선택자 수정(검사 내용은 그대로), 팀 탭 `#98a3b4` axe 실패 처리 방법
- [ ] dev에서도 실패하는 B e2e 4개(운영자 회원 상세·감사 로그·채팅 PR 시트·`/workspace` axe)는 이 PR 범위 밖
- [ ] Free 팀 Flex 안내를 두지 않은 것이 Policy POL-T-7과 다름(Policy 미수정)
- [ ] WBS·Page TODO·디자인 가이드 한국어 원본 반영 필요
- [ ] 11 화면은 Figma대로 '일정 없음' 칩 제거, 목록은 15 링크로만 진입, 준호님 확인 필요 (Page TODO 11·POL-I-3과 다름, 문서 미수정)
- [ ] 추이 제목 "근 2주": Figma "근 한 달"과 다르지만 Policy POL-T-7(14일)에 맞춰 유지
- [ ] 뒤로 아이콘: Figma 11은 `lucide/arrow-left`(←), 지금은 공용 '<' 그대로(이번엔 바꾸지 않음)
- [ ] 백엔드 전체 빌드는 로컬 미완료, 전체 실행 중 page12 테스트 TRUNCATE deadlock 1건(클래스 단독 실행은 109개 통과), CI 확인 필요
