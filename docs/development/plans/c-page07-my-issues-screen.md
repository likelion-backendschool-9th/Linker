# C07 내 이슈 화면 — 작업 기록

> 2026-11-07 · `feat/my-issues-screen` · API 기록은 [c-page07-my-issues.md](c-page07-my-issues.md)

## 범위

- `/workspace` 홈의 내 이슈 미리보기, 팀 변경 시트, `/workspace/issues` 전체 목록.
- 엔드포인트·테이블·페이지 수는 바뀌지 않는다. 기존 `getMyIssues`, `getMyTeams`를 쓴다.
- 기준: 모양·문구는 Figma(7: `123:1966`, 7-팀 리스트: `368:1070`) 우선, 기능·권한·API 계약은 문서 우선(프론트 담당 확인, 2026-11-07).

## 확정한 결정

| 항목 | 결정 |
| --- | --- |
| 선택 팀 카드 | 카드 본문 = 팀 변경 시트, `›` = B의 팀 진입(`teamEntryHref`, 보통 11번) |
| 카드 내용 | 이미지, 팀 이름, "멤버 {n}명". 팀 카드는 '멤버 N명' 유지(5/6·기간 미표기, 프론트 담당 결정). 규칙은 디자인 가이드 5장에 있다 |
| 시트 버튼 | 유지, 문구 "팀 변경". 라디오는 초안이고 버튼을 눌러야 바뀐다 |
| 아래 링크 | Figma "더 보기" 모양, 문구 "내 이슈 전체 보기", 주소는 B의 `myIssuesHref`. 그림자(반경 4, 12%)와 아이콘 간격 2px도 Figma대로(그림자는 가이드에 예외로 기록) |
| `+` 아이콘 | Figma대로 20px. 선택한 팀의 13번 `/teams/{teamId}/issues/new`로 가는 링크, 이름은 화면 낭독기 전용 "이슈 작성"(13번 제목). 모든 팀에서 Figma대로 표시한다. **확인 필요:** 읽기 전용·보관 팀에서 숨길지 프론트 담당(준호님)에게 확인 중이며, 답이 오기 전까지 코드는 바꾸지 않는다 |
| 마감 지남 | 마감 지남 문구 제거(Figma에 없던 요소). `#e62e00` 날짜 한 줄만 표시 |
| 담당자 | 전원 쉼표로 표시, 길면 말줄임 |
| 마감일 없음 | 날짜 칸을 비움 |
| 긴 제목 | 1줄 말줄임, 모든 폭에서 행 높이 70 |
| 시트 행 | Figma대로 높이 40(07 시트만, 44 기준보다 작음). 공용 코드 변경 없음 |
| 시트 열림 | 팀 카드 화살표를 Figma처럼 ∨로 변경 |
| 공용 시트 차이 | 닫기 아이콘, 제목 위치, 제목↔목록 간격은 공용 시트 코드라 맞추지 않음 |
| 전체 목록 | Figma 프레임이 없어 7의 카드·행을 재사용, 팀 변경 진입점 포함 |
| 대비 낮은 색 | Figma 값 유지(`#e62e00` 4.42:1, `#98a3b4` 2.55:1, `#b0b8c1` 2.01:1) |
| 07 시트 모양 | 07 시트만 Figma 값 적용(제목 18px, 반경 20, 패딩 15·16, 스크림 `#191f28` 32% + 블러 6). 스타일은 `MyIssuesTeamPicker.module.css`에 있고, 머리글 높이 60은 맞추지 않는다 |
| 공용 시트 | 공용 시트를 Figma에 맞추는 일은 프론트 담당(준호님) 결정 사항으로 남김. `OverlaySheet`에는 선택 props `classNames`만 추가했고 다른 시트의 모양은 그대로다. 기존 토큰 값은 바꾸지 않았다 |

## Solar 아이콘 교체 (2026-11-08)

디자인 가이드 원칙 11(#279)에 따라 07의 `›`, `∨`, `+`, `↗`를 `lucide-react`에서 `@solar-icons/static`으로 바꿨다. 아이콘 이름은 Figma 7(`123:1966`)과 7-팀 리스트(`368:1070`)의 레이어 이름으로 정했다. 회전·반전된 레이어는 보이는 방향의 Solar 아이콘을 쓴다(프론트 담당 확인, 2026-11-08).

| 화면 | Figma 레이어 | Solar 아이콘 | 크기·색 |
| --- | --- | --- | --- |
| 팀 카드 `›` | `solar:alt-arrow-left-linear` 180° 회전 | `linear/alt-arrow-right` | 20px(`--icon-size-team-entry`, 새 토큰), 선 1.5px, `--color-text-slate` |
| 시트 열림 `∨` | `solar:alt-arrow-left-linear` 90° 회전 | `linear/alt-arrow-down` | 위와 같음 |
| `+` 이슈 작성 | `solar:add-bold` | `bold/add` | 20px(`--icon-size-add`), `--color-text-slate` |
| 내 이슈 전체 보기 `↗` | `solar:arrow-left-up-linear` 좌우 반전 | `linear/arrow-right-up` | 16px(`--icon-size-sm`), 선 1px, `--color-text-slate` |

- Figma `›`는 44px 터치 영역 안에 5×12 화살표, 선 1.5px다. Solar 24 격자를 20px로 줄이고 `stroke-width: 1.8`로 지정해서 실제 선이 1.5px가 되게 했다. 터치 영역은 44px 그대로다.
- `↗`는 Solar 기본 선(24 격자의 1.5)을 16px로 줄이면 Figma의 1px가 되므로 따로 지정하지 않는다.
- `@solar-icons/static`은 SVG 문자열만 제공한다. 패키지 상수를 `aria-hidden` `span`에 `dangerouslySetInnerHTML`로 넣는다. 사용자 입력은 들어가지 않는다.
- 새 토큰 `--icon-size-team-entry`(20px)를 `styles/tokens/layout.css`와 디자인 가이드 3-4에 추가했다. 기존 토큰 값과 공용 컴포넌트는 바꾸지 않았다.
- 이번 범위가 아닌 팀 이미지 대체 아이콘(`Users`, 이미지가 없을 때만 표시)은 `lucide-react`로 남아 있다.

## 상태 색 점

Figma 14·15번에서 `TODO` `#121212`, `IN_PROGRESS` `#007be6`만 라벨과 일치했다. 15번 범례는 "완료"가 초록과 빨강으로 두 번 있어 `BLOCKED`와 `DONE`을 확정할 수 없고, `OTHER`·`NONE` 색은 파일 전체에 없다. API에도 상태 색이 없다.

처음에는 프론트 담당 결정(2026-11-07)으로 `#f0f0f0` 고정색을 썼다. 지금은 다음과 같다.

- **#269 statusColor로 연결 완료.** 고정색은 지웠다.
- 상태 표시는 프론트 담당 결정으로 Figma대로 점만(이름은 화면 낭독기 전용).
- POL-I-3은 07도 상태 이름과 함께로 되어 있으나, 프론트 담당 결정으로 07은 Figma대로 색 점만 표시(이름은 화면 낭독기 전용). Policy는 수정하지 않음.
- 서버는 `OTHER`·`NONE`을 `GRAY`로 준다.
- `NONE`은 문서에 이름이 없어 회색 점만 있고 화면 낭독기 이름도 없다.

## Figma 우선 근거

PR #273 피드백(2026-11-08)으로, 모양과 문구는 Figma를 최우선으로 한다. 접근성·문서 규칙을 이유로 Figma에 없는 요소를 화면에 더하지 않고, 필요한 내용은 화면 낭독기 전용으로만 둔다. 저대비 색, 시트 행 40, 링크 그림자는 이 결정에 따른 예외다.

## 구현 메모

- queryKey는 `['issues', String(teamId), 'mine']`이다. 11~15번은 `['issues', teamId]`를 무효화하므로, 이 접두사 아래에 있어야 함께 갱신된다.
- 기본 팀은 URL에 쓰지 않는다. 내 팀이 아닌 `teamId`는 replace로 지우고, 서버가 400을 주면 `teamId`를 지우고 팀 목록을 다시 받는다.
- 시트의 URL 변경은 `closeAnd`로 닫은 뒤에 한다. 열린 채 바꾸면 `history.back()`이 되돌린다.
- 미리보기 3줄은 UI 제한이며 정책 값이 아니다.
- 미리보기와 전체 목록은 `workspace/_components/my-issues-section`을 함께 쓴다.

## B 리뷰 필요

`workspace/page.tsx`, `workspace/_components/workspace-view/WorkspaceView.tsx`, `WorkspaceView.test.tsx`, `e2e/b-frontend-ui.spec.ts`, `e2e/b-collaboration.spec.ts`는 미리보기를 넣는 데 필요한 최소 변경만 있다. 기존 "내 이슈" 카드 영역을 `MyIssuesSection`으로 교체했고, 링크 주소는 그대로다. 공용 `OverlaySheet.tsx`의 `classNames` 추가도 리뷰 대상이다.

## 목업

`mocks/fixtures/issues.ts`에서 팀 1의 #7(마감 지남), #9(작업 중단), #22(마감일 없음) 담당자에 목업 사용자를 추가했다. `dev:mock`에서 3줄 제한, 마감 지남, 마감일 없음을 볼 수 있다.

## e2e 현황

2026-11-08, `origin/dev`(`4503736`, #294까지) 위로 rebase하고 Solar 교체 후 `pnpm dev:mock` 서버에서 실행했다.

`e2e/b-collaboration.spec.ts`·`e2e/b-frontend-ui.spec.ts` 17건 중 11건 통과, 6건 실패.

- 5건은 `origin/dev`(`4503736`)에서도 같은 실패다: `b-collaboration:85`, `b-collaboration:116`, `b-frontend-ui:79`, `b-frontend-ui:96`, `b-frontend-ui:110`. `b-collaboration:116`(D 목업 환불)은 이번 dev 반영 뒤 새로 생긴 기존 실패다.
- `b-collaboration:60`(팀 설정 → 팀 채팅)은 첫 실행에서 한 번 실패했고, 따로 3회 반복과 다시 실행한 전체 실행에서는 통과했다. 일시적 실패로 보고 숫자에 넣지 않았다.
- 1건(`b-frontend-ui:120`)은 `/workspace`의 `color-contrast` 위반이다(`#98a3b4` 2.55:1 등). Figma 저대비 색을 유지한 결과이며, 테스트는 수정하지 않고 대비 검사도 제외하지 않는다. 아이콘 교체로 생긴 새 위반은 없다.

dev에서 새로 들어온 `e2e/b-team-switcher.spec.ts`(2건)는 모두 통과했다. `e2e/b-frontend-completeness.spec.ts`는 8건 중 6건 통과다. 실패한 `:147`, `:179`는 운영자 화면 실패로, `origin/dev`에서도 같다.
