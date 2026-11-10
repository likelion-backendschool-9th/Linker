# C13 작성 → 상세 목업 404

> 2026-11-10 · `fix/issue-create-detail-mock`

## 원인

- p13 POST가 **브라우저** `ISSUES`에만 `unshift`
- 상세 RSC는 **서버** `mockFetch` → 시드에 id 없음 → 404 → 「볼 수 없는 콘텐츠」
- `mockFetch` 서버/브라우저 모듈 힙이 분리됨

## 고침 (A)

생성분만 쿠키(`linker_mock_created_issues`) + sessionStorage로 브릿지.
`mockFetch` 시작 시 `syncCreatedIssues`, 브라우저에서 `persistCreatedIssues`.
실패/PENDING job 이동·토스트는 그대로.

## 검증

- Vitest `mock-created-issues` / e2e `c-issue-create` (작성→상세 제목)
- 커밋·푸시·실 API 변경 안 함
