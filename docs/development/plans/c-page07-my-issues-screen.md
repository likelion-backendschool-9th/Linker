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
| 카드 내용 | 이미지, 팀 이름, "멤버 {n}명". 정원·기간은 API에 없어 표시하지 않음 |
| 시트 버튼 | 유지, 문구 "팀 변경". 라디오는 초안이고 버튼을 눌러야 바뀐다 |
| 아래 링크 | Figma "더 보기" 모양, 문구 "내 이슈 전체 보기", 주소는 B의 `myIssuesHref` |
| `+` 아이콘 | 07 문서에 없는 기능이라 그리지 않음 |
| 마감 지남 | 날짜 위에 "마감 지남" 문구 + `#e62e00` |
| 담당자 | 전원 쉼표로 표시, 길면 말줄임 |
| 마감일 없음 | 날짜 칸을 비움 |
| 전체 목록 | Figma 프레임이 없어 7의 카드·행을 재사용, 팀 변경 진입점 포함 |
| 대비 낮은 색 | Figma 값 유지(`#e62e00` 4.42:1, `#98a3b4` 2.55:1, `#b0b8c1` 2.01:1) |
| 07 시트 모양 | 07 시트만 Figma 값 적용(제목 18px, 반경 20, 패딩 15·16, 스크림 `#191f28` 32% + 블러 6). 스타일은 `MyIssuesTeamPicker.module.css`에 있고, 머리글 높이 60은 맞추지 않는다 |
| 공용 시트 | 공용 시트를 Figma에 맞추는 일은 프론트 담당(준호님) 결정 사항으로 남김. `OverlaySheet`에는 선택 props `classNames`만 추가했고 다른 시트의 모양은 그대로다. 기존 토큰 값은 바꾸지 않았다 |

## 상태 색 점

Figma 14·15번에서 `TODO` `#121212`, `IN_PROGRESS` `#007be6`만 라벨과 일치했다. 15번 범례는 "완료"가 초록과 빨강으로 두 번 있어 `BLOCKED`와 `DONE`을 확정할 수 없고, `OTHER`·`NONE` 색은 파일 전체에 없다. API에도 상태 색이 없다.

처음에는 프론트 담당 결정(2026-11-07)으로 `#f0f0f0` 고정색을 썼다. 지금은 다음과 같다.

- **#269 statusColor로 연결 완료.** 고정색은 지웠다.
- **07 상태 표시는 POL-I-3(이름과 함께)를 따름. 프론트 담당 확인 대기.** Figma의 점 대신 11~15와 같은 `IssueStatusBadge`로 상태 이름을 화면에 보여 준다. Figma와 다른 부분이다.
- 서버는 `OTHER`·`NONE`을 `GRAY`로 준다.
- `NONE`은 문서에 이름이 없어 글자 없이 회색 점만 보인다. 배지의 기존 동작이며 새 문구를 만들지 않았다.

## 구현 메모

- queryKey는 `['issues', String(teamId), 'mine']`이다. 11~15번은 `['issues', teamId]`를 무효화하므로, 이 접두사 아래에 있어야 함께 갱신된다.
- 기본 팀은 URL에 쓰지 않는다. 내 팀이 아닌 `teamId`는 replace로 지우고, 서버가 400을 주면 `teamId`를 지우고 팀 목록을 다시 받는다.
- 시트의 URL 변경은 `closeAnd`로 닫은 뒤에 한다. 열린 채 바꾸면 `history.back()`이 되돌린다.
- 미리보기 3줄은 UI 제한이며 정책 값이 아니다.
- 미리보기와 전체 목록은 `workspace/_components/my-issues-section`을 함께 쓴다.

## B 리뷰 필요

`workspace/page.tsx`, `workspace/_components/workspace-view/WorkspaceView.tsx`, `WorkspaceView.test.tsx`, `e2e/b-frontend-ui.spec.ts`는 미리보기를 넣는 데 필요한 최소 변경만 있다. 기존 "내 이슈" 카드 영역을 `MyIssuesSection`으로 교체했고, 링크 주소는 그대로다. 공용 `OverlaySheet.tsx`의 `classNames` 추가도 리뷰 대상이다.

## 목업

`mocks/fixtures/issues.ts`에서 팀 1의 #7(마감 지남), #9(작업 중단), #22(마감일 없음) 담당자에 목업 사용자를 추가했다. `dev:mock`에서 3줄 제한, 마감 지남, 마감일 없음을 볼 수 있다.

## e2e 현황

`e2e/b-*.spec.ts` 17건 중 12건 통과, 5건 실패.

- 4건은 변경 전 코드(`a8fadd9`)에서도 같은 실패다: `b-collaboration:85`, `b-frontend-ui:79`, `b-frontend-ui:96`, `b-frontend-ui:110`.
- 1건(`b-frontend-ui:120`)은 `/workspace`의 `color-contrast` 위반이다. Figma 저대비 색을 유지한 결과이며, 테스트는 수정하지 않고 대비 검사도 제외하지 않는다.
