# 0단계: 규칙 문서 정리

상태: 완료 (PR #242 `AGENTS.md`와 blueprint 갱신, #243 `refactor` 라벨 스크립트 제거)

목표: 코드보다 문서를 먼저 새 규칙으로 고친다. 문서가 옛 규칙이면 사람도 에이전트도 옛 방식으로 되돌린다.

## 정한 규칙

> 컨트롤러·서비스 이름 규칙은 1단계에서 한 번 더 바뀌었다. 최신 내용은 [01-api-prefix-and-naming.md](01-api-prefix-and-naming.md)와 `AGENTS.md`를 따른다.

### API 버전
- `/api/v1`은 `WebConfig`의 `PathMatchConfigurer.addPathPrefix("/api/v1", HandlerTypePredicate.forBasePackage("com.linker.backend.controller"))` 한 곳에서 붙인다. 컨트롤러 `@RequestMapping`에는 쓰지 않고 패키지 구조에도 반영하지 않는다.
- 웹훅(`integration.github`)은 이 접두어 대상이 아니다. GitHub App에 등록된 URL이 있으면 바꾸지 않는다.

### Entity
- `entity/{업무}/`에는 `@Entity` 클래스만 둔다(테이블 수와 맞춘다). Enum, 상수, `@Embeddable`, 복합키는 `entity/{업무}/type/`.
- `BaseTimeEntity`와 `@EnableJpaAuditing`은 쓰지 않는다. Entity마다 `createdAt`/`updatedAt`을 `@CreationTimestamp`/`@UpdateTimestamp`로 직접 둔다.

### Repository
- JPA 기본(쿼리 메서드, JPQL `@Query`). `EntityManager`나 동적 쿼리는 `XxxRepositoryCustom` + `XxxRepositoryImpl`(Impl에 `@Repository` 없음, 빈 Custom 금지).
- PostgreSQL 전용 기능(`ON CONFLICT`, `pg_advisory`, `RETURNING`, `LATERAL`)은 네이티브 쿼리와 사유 주석. `FOR UPDATE`는 `@Lock(PESSIMISTIC_WRITE)`.
- 새 `JdbcTemplate` 금지. 여러 Entity를 조회하는 쿼리는 중심 Entity의 Custom에 둔다. QueryDSL은 의존성과 함께 필요할 때 도입한다.
- 이름 규칙에서 벗어난 클래스 10개는 2단계에서 `XxxRepository` 계열로 정리한다.

### 프론트
- 0단계에서는 `frontend/AGENTS.md`와 `03-frontend-blueprint`의 프론트 규칙을 바꾸지 않았다. 3단계에서 정한다.

### Git
- 에이전트 표시(`Co-Authored-By: Claude`, `Generated with Claude Code`, `Made-with: Cursor` 등)는 커밋, PR 본문, 코드, 문서 어디에도 넣지 않는다. CI로 강제한다(#245).
- 브랜치 `<type>/<kebab-case>`, 커밋과 PR 제목 `<type>: <설명>`. type은 `feat`/`fix`/`chore`/`docs` 네 가지(`refactor`는 `chore`로 통합). 설명은 한국어. PR 제목 기준(스쿼시 머지).
- PR Assignee는 워크플로가 자동 지정한다(#245).

## 확인 사항
- **웹훅 URL**: GitHub App에 등록된 URL이 `/api/v1/webhook/github`인지 앱 소유자 확인이 필요하다(`06-github-app.md` 기준 운영 URL은 `https://linker.newlecture.com/api/v1/webhook/github`). 확인 전까지 웹훅 경로는 바꾸지 않는다.
- `refactor` 라벨은 GitHub에서 삭제했고 `scripts/create-labels.sh`에서도 제거했다(#243).

## 이후 단계

| 단계 | 내용 |
| --- | --- |
| 1 | `/api/v1` 전역 설정, 클래스 이름, `BaseTimeEntity` 삭제, `type/` 이동 → [01](01-api-prefix-and-naming.md) |
| 2 | 담당자별 JPA 전환 → [02](02-jpa-migration.md) |
| 3 | 프론트 → [03](03-frontend.md) |
| 4 | README, 프로필, PR 정리, 공동 작성자 줄 → [04](04-cleanup.md) |

`docs/`의 번역본 문서를 바꿨을 때는 한국어 원본도 같이 갱신해야 한다(AGENTS.md).
