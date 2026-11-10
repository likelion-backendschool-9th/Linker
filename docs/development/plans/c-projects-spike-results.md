# C Projects 스파이크 — 실 API 조회 결과

검증일: 2026-11-05 (KST). 대상: 사용자가 제공한 [조직 프로젝트 12](https://github.com/orgs/likelion-backendschool-9th/projects/12).
관련 범위: [C 정책 공유·Projects 계약](c-backend-projects-contract.md).

## 확인한 것

| 구분 | 실제 확인 결과 |
| --- | --- |
| 인증 | 처음에는 `INSUFFICIENT_SCOPES`. 사용자가 `read:project` 인증을 마친 뒤 동일 프로젝트 조회 성공 |
| 인증의 종류 | 개발자 개인 GitHub CLI 로그인. 서비스 GitHub App의 설치 토큰으로 성공한 것은 아님 |
| 프로젝트 | 번호 `12`, node ID `PVT_kwDOEcTE-c4Bp83M` |
| Status | `PVTSSF_lADOEcTE-c4Bp83MzhoWHDs`, 단일 선택 필드 |
| 상태 옵션 | Backlog=`f75ad846`, Ready=`61e4505c`, In progress=`47fc9ee4`, In review=`df73e18b`, Done=`98236657` |
| 시작일 후보 | Start date=`PVTF_lADOEcTE-c4Bp83MzhoWHMY`, 타입 `DATE` |
| 마감일 후보 | Target date=`PVTF_lADOEcTE-c4Bp83MzhoWHMc`, 타입 `DATE` |
| 필드 페이지 | 18개 조회, `fields.pageInfo.hasNextPage=false`. 표본 5개 항목의 fieldValues도 다음 페이지 없음 |
| 이슈 항목 조회 | 첫 5개는 `ISSUE`/`Issue`, Linker 저장소 이슈. GitHub node ID·저장소별 번호·OPEN 상태와 Status 옵션 ID 조회 성공 |
| 표본 한계 | 총 117개 중 첫 5개만 조회. 이 표본에는 날짜 값이 없으므로 실제 날짜 값의 읽기·설정·해제를 검증한 것은 아님 |
| 변경 API의 입력 계약 | 실제 스키마에서 `projectId`, `itemId`, `fieldId`, `value` 확인. 값 입력에 `date: Date`, `singleSelectOptionId: String` 존재 |
| 해제 API의 입력 계약 | `ClearProjectV2ItemFieldValueInput`에 `projectId`, `itemId`, `fieldId` 존재 확인 |

이 보드는 팀의 개발 작업 관리 보드다. Linker 서비스에서 선택한 보드나 실제 테스트용 보드라는 증거는 없다.
표의 ID는 재현 증거이며 서비스 기본값으로 하드코딩하지 않는다.

## 계약에 반영할 결론

- `Blocked` 옵션이 없다. Todo/In Progress/Blocked/Done이라는 이름이 모든 기존 보드에 있다고 가정하면 안 된다.
- 기존 보드 연결 시 이름을 자동 치환하지 말고 실제 옵션 ID와 사용자의 매핑을 사용한다. Backlog·Ready·In review를 임의의 내부 상태로 확정하지 않았다.
- 이 보드의 마감일 필드 이름은 `Due date`가 아니라 `Target date`다. 날짜 필드는 타입·ID를 확인하고 연결 의미를 확정해야 한다. 이름만으로 마감일이라고 자동 지정하지 않는다.
- 필드 조회와 항목의 `fieldValues` 조회는 구분한다. 날짜 필드가 존재하는 것과 항목에 날짜 값이 있는 것은 다르다.
- 조회 쿼리에는 `pageInfo`를 포함한다. 표본 조회 성공은 전체 이슈 캐시 동기화 성공을 뜻하지 않는다.

## 재현 방법

프로젝트 루트에서 GitHub CLI 로그인(`read:project`)을 사용한다. 토큰을 명령·문서·저장소에 직접 적지 않는다.

```bash
gh api graphql \
  -F query=@docs/development/plans/c-projects-read-spike.graphql \
  -f owner=likelion-backendschool-9th -F number=12

gh api graphql \
  -F query=@docs/development/plans/c-projects-write-schema-spike.graphql

gh api graphql -f 'query=query { __type(name:"ClearProjectV2ItemFieldValueInput") { inputFields { name } } }'
```

쿼리는 모두 읽기 전용이다. `projectV2`가 null이거나 `errors`가 있으면 성공으로 판정하지 않는다.
`fields.pageInfo.hasNextPage`가 true이면 필드 전체를 확인한 것으로 간주하지 않는다.
items는 의도적으로 첫 5개만 조회하며 `hasNextPage`가 true인 상태도 그대로 표시한다.
토큰 갱신 전 실패와 갱신 후 성공을 구분해 확인했다.

## 남은 검증과 경계

| 항목 | 상태·이유 |
| --- | --- |
| 보드·필드·상태 옵션 실 조회 | 성공. 위 ID·타입 확인 |
| Blocked 설정 후 OPEN 유지 | 미실행. 해당 옵션이 없고 개인 인증은 읽기 권한만 추가함 |
| 날짜 설정·비우기 후 재조회 | 미실행. 지정된 변경 테스트 항목과 쓰기 권한 없음 |
| GitHub App 설치 토큰으로 조회 | 미실행. #179 이후 별도 `GithubAppProperties`·`GithubAppClient.installationReadToken(외부설치ID)`가 제공되지만 실제 App 권한·Projects 호출 검증은 남아 있음. 기존 개인 인증 조회 결과와 구분 |
| 실제 웹훅 수신·C 처리 | 미실행. B의 수신·큐·handler 확장 지점은 있으나 C Projects handler는 없음 |
| 캐시 저장·재시도·동시 변경 | 미실행. DB 또는 정식 페이지 구현으로 확장하지 않음 |

현재 결과는 **개인 인증을 사용한 실 API 조회 및 스키마 계약 확인**이다.
Blocked·날짜 쓰기·설치 토큰·웹훅까지 포함한 전체 스파이크 통과나 팀 전체 freeze를 선언하지 않는다.
팀 보드의 옵션·날짜·이슈·웹훅 설정과 공유 DB는 변경하지 않았다.

## 공식 근거

- [GitHub Projects API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects): 조회의 `read:project`와 변경의 `project` 권한을 구분한다.
- [projects_v2_item 웹훅](https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item): GitHub App의 조직 Projects 읽기 권한이 필요하다. 개인 CLI 조회 성공으로 App 구독·수신을 입증할 수 없다.
