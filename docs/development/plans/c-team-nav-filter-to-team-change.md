# C 11·14·15 — 앱바 아이콘 → 팀 변경

> 2026-11-10 · `fix/team-nav-filter-to-team-change`

## 범위

1. `/teams/[id]/issues` · `board` · `calendar` 헤더 우측 아이콘 클릭 → 기존 `TeamChangeSheet` (`overlay=team-switcher`) 오픈.
2. `IssueFilterButton` / `IssueFilterSheet` / `overlay=issue-filter` 제거.
3. 팀 이름(`TeamSwitcher`) 클릭 → 팀 변경은 유지. 아이콘은 기존 SlidersHorizontal 유지(동작만 교체).

## 비범위

09 설정, 13, 보드 X스크롤, Policy 문서, `TeamChangeSheet` 내부 디자인, 보드「상태 필터」·정렬 메뉴.

## 참고 (Policy)

Policy/Page TODO에 이슈 필터 시트가 남아 있으면 PR 리뷰에만 명시. 이 작업에서 Policy는 수정하지 않음.

## 검증

- lint / typecheck 통과
- Vitest (TeamSwitcher·TeamFrame·BoardView·CalendarView, `--maxWorkers=2`) 통과
- e2e 핵심(헤더 아이콘→팀 변경, 보드/캘린더 헤더) 통과
- axe `landmark-unique`(Toaster 중복 region)는 환경 이슈로 width 루프 실패 가능 — 이전 보드 overflow 계획과 동일, 이번 변경과 무관
- 커밋·푸시·전체 build 안 함
