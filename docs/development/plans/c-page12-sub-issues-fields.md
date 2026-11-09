# C12 후속 — 하위 이슈 상태·담당자·마감일

> 2026-11-09 · `feat/sub-issues-fields` · 선행: [c-page12-detail-screen.md](c-page12-detail-screen.md)

## 범위

- `GET .../sub-issues` `SubIssue`에 `status`·`statusColor`·`dueDate`·`assigneeName` 추가.
- 연결(`id`): DB 캐시. 미연결: GitHub 첫 담당자 이름만, status/due=null. Project 재조회 없음.
- 12 상세 하위 행: Figma 198:755 — 제목+색점 / `# · 레포 · 담당자` / 오른쪽 `M월 D일`(지난+미완료 빨강).

## 비범위

- assignees[]·overdue API 필드, 「외 N명」, Policy/토큰 값 변경, 부모 카드 큰 변경.

## Policy·Figma 차이 (문서 미수정)

- 하위 행 날짜는 `M월 D일`(부모 카드는 `YYYY년 M월 D일`).
- 레포명은 기존처럼 **부모** `repoName`(API에 자식 레포 필드 없음). 교차 레포 Figma와 다를 수 있음.

## 검증

- lint / typecheck / Vitest(issue detail·sheets) / e2e `c-issue-detail`
- 커밋·푸시·전체 build 안 함
