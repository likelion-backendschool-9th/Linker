# 2단계: JdbcTemplate → JPA 전환 (담당자별)

상태: 시작 전 (1단계 #244, CI 규칙 #245는 머지됨)

대상 독자: 백엔드를 맡은 팀원 A–E. 각자 자기 영역 브랜치에서 진행한다.
기준: 1단계 PR #244가 `dev`에 머지된 상태. 규칙의 원본은 루트 `AGENTS.md`(Entity and repository / Mandatory backend service rule)와 `docs/development/05-backend-blueprint.md` §3–§4. 이 문서는 그 규칙을 실제 파일에 대입한 실행 가이드다.

## 0. 원래 계획의 담당 배정 (초기 계획)

| 담당 | 할 일 (원래 계획) |
| --- | --- |
| C (준영님) | 이슈 테이블을 정식 Flyway로 옮기고, 이슈 Entity를 만들고, 이슈 레포지토리 7개를 JdbcTemplate에서 JPA로 전환 |
| D (윤수님) | 채팅 레포지토리 4개 JPA 전환, 채팅 Entity와 Enum 정리(테이블 개수와 맞추기) |
| B (도균님) | 팀 레포지토리 3개 JPA 전환 |
| A (명석님) | 프로필 쿼리 JPA 전환, 프론트 URL `/u/[login]` 변경(WBS와 시드도 함께) |
| E (준호님) | 23번 `comment-menu-sheet` 등 컴포넌트를 hook, api, 화면, 스타일로 분리 |

원래 계획의 "모두: Entity 폴더에서 테이블이 아닌 것 빼고 Enum을 Entity 옆으로"는 1단계 PR #244에서 끝났다(`entity/{업무}/type/`). 2단계에서 다시 할 필요 없다.

원래 계획과 코드를 대조하면 파일 수가 맞는다: 이슈 레포지토리 7개(`repository/issue/`), 채팅 4개(`ChatListQueryRepository`, `ChatMessageQueryRepository`, `ChatShareCardQuery`, `RecruitingOfferQuery`), 팀 3개(`TeamSetupRepository`, `WorkspaceTeamRepository`, `OwnedTeamQuery`).

**계획에 없는 항목 (배정 필요)**: 레포지토리가 아니라 서비스·전역·핸들러에 SQL이 있는 파일 7개는 원래 계획의 개수에 들어 있지 않다. 5절에서 "배정 필요"로 표시했다.
- `TeamSyncService`, `IssueProgressService`, `AdService`, `ReportContentEffects`, `GithubIssueWebhookHandler`, `TeamChatAccess`, `MembershipTeamAccess`

**계획에 없는 선행 작업**: B의 팀 테이블도 C의 이슈 테이블처럼 Flyway에 없고 Entity가 없다(2-1). 원래 계획은 C만 "Flyway로 옮기고 Entity를 만든다"고 적었다. B도 같은 작업이 필요하다.

> 이 문서의 파일별 수치(호출 수, 네이티브 후보)는 2026-11-06 `dev` 기준 `grep` 결과라 대략치다. 작업 전에 직접 다시 확인한다.

## 1. 목표와 범위

목표: 영속성 접근을 Repository로 모으고 JPA를 기본으로 쓴다. 서비스·전역 클래스에 SQL이 남지 않게 한다.

범위
- `JdbcTemplate`/`NamedParameterJdbcTemplate`을 쓰는 main 파일 22개.
- 이름 규칙에서 벗어난 영속 클래스 10개를 `XxxRepository` 계열로 정리.

범위 밖
- 스키마 변경, API(URL·응답 형태) 변경, 동작 변경. 결과는 전환 전과 같아야 한다.
- 프론트(3단계).

## 2. 먼저 알아야 할 것 (선행 사실)

### 2-1. 이슈·팀 테이블은 아직 Flyway에도 Entity에도 없다
- `backend/src/main/resources/db/issue-schema/*.sql`(5개 테이블)과 `db/team-schema/*.sql`(7개 테이블)에 SQL로만 있고, `db/migration/`(V1~V19)에는 없다.
- `entity/` 아래에 `issue`, `team` 패키지가 없다. JPA로 바꾸려면 Entity가 먼저 필요하다.
- `application.yml`의 `linker.issues.*`, `linker.team-setup.*` 플래그는 "스키마가 정식 적용될 때까지 꺼 둔다"는 주석과 함께 `false`가 기본이다.
- 따라서 **B(팀)와 C(이슈)는 쿼리를 바꾸기 전에 다음을 먼저 정해야 한다.**
  1. 마이그레이션 순서와 번호(V20 이후)를 B·C가 합의한다. 같은 번호를 동시에 만들면 충돌한다.
  2. `*-schema/*.sql`을 Flyway 마이그레이션으로 옮길지(운영 DB 적용 방식 포함)를 정한다.
  3. 테이블마다 `@Entity`를 만든다(ERD `docs/development/01-erd.md`와 대조). "Entity 파일 수 = 테이블 수" 규칙을 지킨다.
  4. 그 뒤에 쿼리 전환을 한다.
- 이 선행 작업이 2단계에서 가장 큰 덩어리다. 일정 산정 때 쿼리 전환과 분리해서 본다.
- D·A는 해당 테이블(채팅, 프로필 등)에 이미 Entity와 마이그레이션이 있어 바로 전환할 수 있다. 단, 쿼리가 참조하는 테이블에 Entity가 없는지 확인한다.

### 2-2. Custom/Impl 선례가 아직 없다
- `XxxRepositoryCustom`/`XxxRepositoryImpl` 패턴을 쓰는 코드가 지금 저장소에 없다. 가장 먼저 하는 사람이 패턴을 만든다.
- 첫 PR에서 아래 4절의 뼈대를 그대로 쓰고, 이후 사람이 따라 한다. 먼저 시작하는 사람은 팀 채널에 알린다.

## 3. 지켜야 할 규칙 (AGENTS.md 발췌)

1. JPA가 기본이다. 쿼리 메서드와 `@Query`(JPQL)를 먼저 쓴다.
2. `EntityManager`나 동적 쿼리가 필요하면 `XxxRepositoryCustom`(인터페이스) + `XxxRepositoryImpl`을 둔다.
   - Impl에는 `@Repository`를 붙이지 않는다.
   - 빈 `Custom`을 미리 만들지 않는다. 필요한 메서드가 생길 때 만든다.
   - 여러 Entity를 조회하는 쿼리는 **중심 Entity의 Custom**에 둔다.
3. PostgreSQL 전용 기능은 네이티브 쿼리로 쓰고 **이유를 주석으로 남긴다.**
   - 대상: `ON CONFLICT`, `pg_advisory_*`, `RETURNING`, `LATERAL`
   - `FOR UPDATE`는 `@Lock(LockModeType.PESSIMISTIC_WRITE)`로 쓴다.
4. 새 `JdbcTemplate`을 만들지 않는다. QueryDSL은 의존성과 함께 도입하기 전에는 쓰지 않는다.
5. 영속 클래스 이름은 `XxxRepository`다(`XxxQuery`, `XxxLock`, `XxxInserter` 금지).
6. 서비스·컨트롤러·`global` 클래스에 SQL이나 `JdbcTemplate`을 남기지 않는다. 쿼리는 Repository로 옮긴다.
7. 컨트롤러는 Entity를 반환하지 않는다. 조회 결과는 DTO(`dto/{업무}/response`)로 변환한다.
8. Entity는 `createdAt`/`updatedAt`을 직접 선언한다(`@CreationTimestamp`/`@UpdateTimestamp`). `BaseTimeEntity`는 없다.
9. 역할 폴더(`user/`, `recruiter/`, `admin/`)의 컨트롤러·서비스는 접두어 없이 쓰고 빈 이름을 명시한다(`@Service("userTeamService")`). 새 클래스를 만들 때 잊지 않는다.
10. HTTP 경로, 권한, OpenAPI `@Tag`·`operationId`, STOMP 목적지는 바꾸지 않는다.
11. Entity·Repository는 업무 단위로 공유한다. 페이지나 역할별로 복제하지 않는다.

## 4. 변환 가이드

### 4-1. 판단 순서
1. 단순 조회, 단건·목록, 존재 여부 → 쿼리 메서드 (`findByTeamIdAndStatus`, `existsByUserIdAndTeamId`).
2. 조건·조인이 있지만 정적이다 → `@Query` JPQL (+ `Pageable`/DTO 프로젝션).
3. 조건이 동적으로 붙거나 페이징·커서가 복잡하다 → `XxxRepositoryCustom` + `XxxRepositoryImpl` (`EntityManager`, Criteria 또는 JPQL 문자열 조립).
4. 아래 PostgreSQL 기능이 꼭 필요하다 → 네이티브 `@Query(nativeQuery = true)` 또는 Impl 안의 `createNativeQuery`, 이유 주석 필수.

### 4-2. 뼈대 (참고용)

쿼리 메서드 / JPQL
```java
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

	boolean existsByTeamIdAndUserId(long teamId, long userId);

	@Query("select m.teamId from TeamMember m where m.userId = :userId and m.status = :status")
	List<Long> findTeamIds(@Param("userId") long userId, @Param("status") MemberStatus status);
}
```

Custom + Impl
```java
public interface IssueRepositoryCustom {
	List<IssueListRow> search(IssueSearchCondition condition);
}

// 파일: IssueRepositoryImpl.java — @Repository를 붙이지 않는다. Spring Data가 이름 규칙으로 연결한다.
class IssueRepositoryImpl implements IssueRepositoryCustom {

	private final EntityManager entityManager;

	IssueRepositoryImpl(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Override
	public List<IssueListRow> search(IssueSearchCondition condition) {
		// 조건에 따라 JPQL 문자열을 조립하고 파라미터는 반드시 바인딩한다(문자열 연결로 값 삽입 금지).
		...
	}
}

public interface IssueRepository extends JpaRepository<Issue, Long>, IssueRepositoryCustom {
}
```
주의: 이 프로젝트 규칙은 Impl 이름을 `<Repository 인터페이스 이름>Impl`로 쓰는 것이다(`IssueRepository` → `IssueRepositoryImpl`). Spring Data는 `IssueRepositoryCustomImpl` 형태도 인식하지만 규칙과 맞추기 위해 쓰지 않는다. 첫 PR에서 실제로 연결되는지(애플리케이션 기동, 메서드 호출) 꼭 확인한다.

네이티브(이유 주석)
```java
// ON CONFLICT upsert는 JPQL로 표현할 수 없어 네이티브로 쓴다.
@Modifying
@Query(value = """
		insert into issue_cache (...) values (...)
		on conflict (github_issue_id) do update set ...
		""", nativeQuery = true)
int upsert(...);
```

락
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select t from Team t where t.id = :id")
Optional<Team> findByIdForUpdate(@Param("id") long id);
```
`pg_advisory_xact_lock` 등 어드바이저리 락은 네이티브로 쓴다. 트랜잭션 안에서 호출되는지 확인한다.

### 4-3. 주의할 함정
- **N+1**: JPQL로 바꾸면 연관 조회가 지연 로딩으로 N번 나갈 수 있다. 목록 API는 `join fetch`나 DTO 프로젝션을 쓰고, 쿼리 수가 전환 전보다 늘지 않았는지 확인한다.
- **영속성 컨텍스트 캐시**: 네이티브로 직접 갱신한 행은 이미 로딩된 Entity에 반영되지 않는다. 필요하면 `@Modifying(clearAutomatically = true)`나 `flush`/`refresh`를 쓴다.
- **트랜잭션 경계**: JdbcTemplate은 어디서든 쿼리를 실행했지만 JPA 쓰기는 트랜잭션이 필요하다. 서비스 메서드의 `@Transactional`을 확인한다.
- **정렬·커서**: 커서 페이징은 동률 처리(보조 정렬 키)를 그대로 유지한다. 결과 순서가 바뀌면 중복·누락이 생긴다.
- **시간대·타입**: `timestamptz` ↔ `Instant`, `jsonb` 컬럼 매핑(`@JdbcTypeCode(SqlTypes.JSON)`) 등을 기존 결과와 비교한다.
- **LATERAL**: JPQL로 못 쓴다. 네이티브로 두고 주석을 남기는 것이 정답이다. 억지로 JPQL로 바꾸지 않는다.
- 행 매퍼(`RowMapper`)가 만들던 응답 객체는 DTO 프로젝션이나 생성자 표현식으로 대체한다. 서비스에서 Entity → DTO 변환 위치를 정해 둔다.

## 5. 영역별 대상 파일 (담당은 추정이므로 확인할 것)

호출 수는 `jdbc.`/`named.` 사용 횟수, 네이티브 후보는 해당 키워드가 파일에 있다는 뜻이다.

### C (준영님) — 이슈
| 파일 | 호출 | 네이티브 후보 |
| --- | --- | --- |
| repository/issue/IssueCacheRepository | 15 | ON CONFLICT, RETURNING |
| repository/issue/IssueReadRepository | 11 | 없음 (조회 중심, Custom 후보) |
| service/user/IssueProgressService | 11 | ON CONFLICT (서비스 안 SQL → Repository로) — **배정 필요(C로 추정)** |
| repository/issue/IssueContextRepository | 6 | 없음 |
| repository/issue/IssueCreateJobRepository | 2 | advisory, RETURNING |
| repository/issue/IssueReminderRepository | 2 | advisory |
| repository/issue/IssueEditJobRepository | 1 | RETURNING |
| repository/issue/IssueDetailRepository | 1 | 없음 |
| integration/github/GithubIssueWebhookHandler | 2 | 없음 (핸들러 안 SQL → Repository로) — **배정 필요(C로 추정)** |
| `IssueSyncLock` (이름 정리) | - | 락 방식 확인 |

선행: 2-1의 이슈 스키마 마이그레이션·Entity.
테스트: `repository/issue/IssueReadIntegrationTest` 등이 JdbcTemplate 픽스처를 쓴다(7절 참고).

### D (윤수님) — 채팅
| 파일 | 호출 | 네이티브 후보 |
| --- | --- | --- |
| repository/chat/ChatMessageQueryRepository | 9 | 없음 |
| repository/chat/ChatListQueryRepository | 5 | LATERAL |
| repository/chat/ChatShareCardQuery | 4 | 없음 |
| repository/chat/RecruitingOfferQuery | 4 | LATERAL |
| global/realtime/TeamChatAccess | 3 | 없음 (팀 멤버십 조회, B와 공유 로직) — **배정 필요(D로 추정)** |

이름 정리 4개: `ChatListQueryRepository`, `ChatMessageQueryRepository`, `ChatShareCardQuery`, `RecruitingOfferQuery`.
`ChatRoom`, `ChatMessage` 등 Entity가 이미 있어 선행 작업이 적다.
`TeamChatAccess`는 `MembershipTeamAccess`(B)와 같은 팀 멤버십 질의를 한다. 한 곳(팀 Repository)으로 합치는지 B와 조율한다.

### B (도균님) — 팀
| 파일 | 호출 | 네이티브 후보 |
| --- | --- | --- |
| repository/team/TeamSetupRepository | 30 | ON CONFLICT(3), RETURNING(5), FOR UPDATE(2) |
| service/user/TeamSyncService | 21 | ON CONFLICT (서비스 안 SQL → Repository로) — **배정 필요(B로 추정)** |
| repository/team/WorkspaceTeamRepository | 4 | 없음 |
| repository/team/OwnedTeamQuery | 3 | 없음 (이름 정리) |
| global/security/MembershipTeamAccess | 3 | 없음 (`global`에서 SQL 제거) — **배정 필요(B로 추정)** |
| `TeamSetupLock` (이름 정리) | - | 락 방식 확인 |

선행: 2-1의 팀 스키마 마이그레이션·Entity.
가장 큰 파일 두 개(`TeamSetupRepository`, `TeamSyncService`)가 B에 있다. 일정 산정에 반영한다.

### A (명석님) — 프로필, 프론트 URL
| 파일 | 호출 | 네이티브 후보 |
| --- | --- | --- |
| repository/profile/PublicProfileQuery | 5 | 없음 (이름 정리, 원래 계획의 "프로필 쿼리") |
| service/recruiter/AdService | 4 | 없음 (서비스 안 SQL → Repository로) — **배정 필요(A로 추정)** |
| service/admin/ReportContentEffects | 6 | 없음 (서비스 안 SQL → Repository로) — **배정 필요(A로 추정)** |

**프론트 URL `/u/[login]` 변경**: 원래 계획에 "WBS와 시드도 함께"라고만 적혀 있고 변경 후 URL은 문서에 없다. A가 새 URL 형태를 먼저 정하고 `docs/planning/07-page-todo.md`, `docs/development/02-wbs.md`, Policy 접근표, 시드 데이터, 백엔드의 프로필 링크 생성 코드와 sitemap을 함께 확인한다. URL이 바뀌면 AGENTS.md "Page/URL/screen changes" 규칙대로 TODO, WBS, Policy, 블루프린트를 갱신한다. 백엔드 JPA 전환과 **별도 PR**로 한다.
`PublicProfileQuery`가 읽는 완료 기록·팀 멤버십 테이블은 팀 스키마(B)에 있어 Entity가 B의 선행 작업에 의존한다. 이 파일은 B의 Entity가 생긴 뒤에 전환한다.

### E (준호님) — 컴포넌트 분리, 이름 정리
`JdbcTemplate`은 쓰지 않는다. 백엔드는 이름 정리만 있고, 주 업무는 프론트 컴포넌트 분리다.

- 23번 페이지의 `comment-menu-sheet` 등 큰 컴포넌트를 hook, api, 화면, 스타일로 분리한다(`frontend/AGENTS.md`의 `_components`/`_hooks`/`_lib`/`_views` 구조와 blueprint §5-3의 분리 사유를 따른다). 3단계(컴포넌트 파일명 PascalCase 일괄 변경)와 같은 파일을 건드리므로 **3단계 전에 끝내거나 시점을 조율한다.**
- `BlockInserter` (`EntityManager` 사용) → `UserBlockRepositoryCustom` + `UserBlockRepositoryImpl`
- `ReportCaseOpener` (`EntityManager` 사용) → `ReportCaseRepositoryCustom` + `ReportCaseRepositoryImpl`
- 이미 `UserBlockRepository`, `ReportCaseRepository`가 있으므로 여기에 Custom을 붙인다. 위 "Custom/Impl 선례가 없다"(2-2)의 첫 사례가 되기 쉬우므로 가장 먼저 패턴을 만드는 사람으로 적당하다.

## 6. 이름 정리 10개 제안

| 현재 | 제안 | 비고 |
| --- | --- | --- |
| ChatListQueryRepository | `ChatRoomRepositoryCustom` + Impl | 중심 Entity: ChatRoom (여러 테이블 조회) |
| ChatMessageQueryRepository | `ChatMessageRepositoryCustom` + Impl | |
| ChatShareCardQuery | `ChatMessageRepositoryCustom`에 병합 또는 별도 Custom | 담당자가 중심 Entity 판단 |
| RecruitingOfferQuery | 중심 Entity의 Custom | 담당자 판단 |
| PublicProfileQuery | `UserRepositoryCustom` (또는 프로필 중심 Entity) | |
| OwnedTeamQuery | `TeamRepository` 쿼리 메서드 | 단순하면 Custom 불필요 |
| IssueSyncLock | `IssueRepository`의 락/네이티브 메서드 | |
| TeamSetupLock | `TeamRepository`의 락/네이티브 메서드 | |
| BlockInserter | `UserBlockRepositoryCustom` + Impl | |
| ReportCaseOpener | `ReportCaseRepositoryCustom` + Impl | |

이름은 제안이다. 중심 Entity를 정하는 일은 담당자 몫이다. 이름을 바꾸는 PR과 쿼리를 전환하는 PR을 나누고 싶으면 이름만 먼저 바꿔도 된다(둘 다 `chore:`).

## 7. 테스트 방침

- 테스트 12개가 `JdbcTemplate`을 쓴다(통합 테스트의 데이터 준비·검증용). 권장: **테스트의 픽스처용 JdbcTemplate은 그대로 둔다.** 규칙의 "새 JdbcTemplate 금지"는 main 코드 대상이다. 팀이 다르게 정하면 문서를 고친다. (확정 필요)
- 전환 전에 해당 쿼리를 다루는 테스트가 있는지 확인하고, 없으면 먼저 전환 전 동작을 고정하는 테스트를 추가한다.
- 전환 후 같은 입력에 같은 결과(정렬, 커서 포함)가 나오는지 비교한다.
- 목록·조회 API는 쿼리 수가 늘지 않았는지 확인한다(N+1). 로그의 SQL 수로 간단히 비교해도 된다.
- 변경한 영역의 `./gradlew test` 전체 통과가 머지 조건이다.
- 변경 전후로 `/v3/api-docs`와 핸들러 경로가 같은지 확인한다(1단계에서 쓴 방식).

## 8. 작업 방식과 PR 규칙

- 흐름: `dev` 최신화 → 작업 브랜치 → 커밋 → 푸시 → `dev`로 PR → 리뷰 → 머지.
- 브랜치: `chore/<영역>-jpa-<설명>` 형식을 권장. 예: `chore/chat-jpa-queries`. 타입은 `feat|fix|chore|docs`만 허용된다(`refactor` 없음).
- 커밋·PR 제목: `chore: 채팅 목록 조회를 JPA로 전환`처럼 한국어 설명. CI(`pr-rules`)가 형식·한국어·브랜치 type 일치·에이전트 표시를 검사한다.
- 에이전트 표시(`Co-Authored-By: Claude`, `Generated with …`)를 커밋·PR 본문·코드·문서에 넣지 않는다. `frontend`에서 `pnpm install`을 한 번 실행하면 로컬 `commit-msg` 훅이 설치된다.
- PR은 작게 나눈다. 권장 단위: 파일 하나 또는 Repository 하나. 테이블 단위로 Entity를 먼저 올리는 PR과 쿼리 전환 PR을 나눠도 된다.
- PR Assignee는 워크플로가 자동 지정한다.
- 같은 파일을 두 명이 동시에 고치면 충돌한다. `TeamChatAccess`·`MembershipTeamAccess`처럼 영역이 겹치는 파일은 먼저 팀 채널에서 담당을 정한다.
- 시작 전, `dev`를 받아 클래스 이름(1단계에서 접두어 제거) 기준으로 파일을 다시 찾는다. 오래된 브랜치는 1단계 이름 변경과 충돌한다.

## 9. 문서·합계 갱신

- 테이블이 늘거나(이슈·팀 Entity 추가 등) 컬럼·enum이 바뀌면 `AGENTS.md`의 "Keep code and documents consistent"에 따라 ERD(`docs/development/01-erd.md`), WBS 페이지 표, 합계(테이블 69개 등)를 같이 갱신한다.
- 합계 기준(AGENTS.md): 33 pages + foundation 00, 18 business systems, 29 HTTP controllers, 205 REST endpoints, 5 realtime paths, 69 tables.
- `docs/`는 한국어 원본의 번역본이다. 바꾼 문서 목록을 PR 본문에 적어 원본 갱신자에게 알린다.

## 10. 진행 체크리스트 (영역별 복사해서 사용)

- [ ] `dev` 최신화, 브랜치 생성
- [ ] (B·C) 마이그레이션 번호 합의, 스키마 → Flyway, Entity 작성, ERD·합계 갱신
- [ ] 대상 파일의 쿼리별로 변환 방식 결정(쿼리 메서드 / JPQL / Custom / 네이티브)
- [ ] 네이티브 쿼리마다 사유 주석
- [ ] 서비스·`global` 클래스에서 SQL 제거
- [ ] 이름 규칙 10개 중 담당 클래스 정리
- [ ] 변환 전후 동작 동일(결과, 정렬, 커서, 쿼리 수) 확인
- [ ] `./gradlew test` 통과
- [ ] `/v3/api-docs`·핸들러 경로 변화 없음
- [ ] 문서 갱신 필요 항목 PR 본문에 기록
- [ ] 에이전트 표시 없음, PR 제목·브랜치 규칙 준수

## 11. 결정이 필요한 것

| 항목 | 제안 | 결정할 사람 |
| --- | --- | --- |
| 이슈·팀 스키마를 Flyway로 옮기는 순서와 번호 | B·C가 먼저 합의 | B, C |
| 테스트의 픽스처용 JdbcTemplate | 유지 | 팀 |
| `TeamChatAccess`·`MembershipTeamAccess` 통합 | 팀 Repository 한 곳으로 | B, D |
| 이름 정리와 쿼리 전환을 한 PR로 할지 | 가능하면 분리 | 각 담당자 |
| 첫 Custom/Impl 패턴 작성자 | E (`BlockInserter`/`ReportCaseOpener`). 단 E의 주 업무는 프론트이므로 먼저 시작하는 사람이 맡아도 된다 | 팀 |
| 배정 필요 7개 파일(5절) | 추정 담당자 확인 | 팀 |
| B의 팀 스키마 Flyway·Entity 작업 포함 여부 | 포함 | B |
| `/u/[login]` 새 URL | A가 제안 후 팀 확인 | A |
