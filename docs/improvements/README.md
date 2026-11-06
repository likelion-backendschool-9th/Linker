# 개선 단계별 계획

`/api/v1` 전역 설정, 클래스 이름, JPA 전환 등 구조를 새 규칙으로 정리하는 작업의 단계별 기록과 계획이다. 규칙의 기준은 루트 `AGENTS.md`와 `docs/development/05-backend-blueprint.md`이고, 이 폴더는 **작업 순서와 담당, 결정 사항**을 담는다.

이 폴더의 문서는 처음부터 한국어로 쓴 내부 작업 문서다. 한국어 원본의 번역본이 아니므로 `docs/`의 "원본 갱신 요청" 대상이 아니다.

| 단계 | 문서 | 상태 |
| --- | --- | --- |
| 0 | [00-rules-docs.md](00-rules-docs.md) 규칙 문서 정리 | 완료 (#242, #243) |
| 1 | [01-api-prefix-and-naming.md](01-api-prefix-and-naming.md) `/api/v1`, 클래스 이름, Entity 구조, CI 규칙 | 완료 (#244, #245) |
| 2 | [02-jpa-migration.md](02-jpa-migration.md) JdbcTemplate → JPA, 담당자별 | 진행 중 (B #248, D #249, A #251 일부, C `chore/issue-jpa`) |
| 3 | [03-frontend.md](03-frontend.md) 프론트 컴포넌트 파일명, lint, URL·WBS 대조 | 시작 전 |
| 4 | [04-cleanup.md](04-cleanup.md) README, 프로필, 과거 PR·커밋 정리 | 시작 전 |

단계가 끝나면 각 문서 맨 위의 상태와 이 표를 같이 고친다. 결정이 바뀌면 해당 문서의 "결정이 필요한 것" 표를 먼저 갱신한다.
