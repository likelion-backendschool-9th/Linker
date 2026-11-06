# C15 캘린더·마감 전날 알림 — 구현 및 검증

> 기준: dev `cab3858` (#226 포함) / `feat/15-page-api` / [Backend #94](https://github.com/likelion-backendschool-9th/Linker/issues/94)

## 범위

WBS S08·P15, Page TODO 15, Policy 7장·POL-N-1에 따라 C 담당 캘린더 GET과 마감 전날 09시 알림 생산자를 구현한다. 화면 교체·일정 드래그·AI·07 내 이슈는 포함하지 않는다. Page TODO의 07 연결 항목은 별도 [#78](https://github.com/likelion-backendschool-9th/Linker/issues/78)에서 추적하며 이번 PR에 섞지 않는다.

기존 `UserIssueController → UserIssueService → IssueReadRepository`를 사용한다. `UserIssueReminderService → IssueReminderRepository`는 같은 user 그룹의 실제 백그라운드 업무이며 기존 `UserNotificationService.create(CreateNotificationCommand)`를 호출한다. 새 컨트롤러·테이블·REST 계약은 추가하지 않으며 기존 205개 중 P15의 1개를 구현한다.

## 캘린더 계약

`GET /api/v1/user/teams/{teamId}/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&assignee=`

- `from`, `to` 필수. 양 끝을 포함하며 from≤to다. ISO/DB 호환을 위해 1~9999년 날짜만 받는다. 날짜 수·월 수에 상품 한도를 새로 만들지는 않는다.
- `assignee`는 기존 11번과 같은 GitHub 로그인이다. 빈 값은 전체, 최대 길이 검사는 기존 IssueListQuery를 재사용한다.
- 태그 `p15-calendar`, operationId `getTeamIssueCalendar`, 개발자·현재 팀원·no-store다. 읽기 전용 팀도 조회할 수 있고 운영자도 팀 권한을 우회하지 않는다.
- 응답은 기존 화면 mock과 같은 `{from,to,items}`다. items는 11/14의 기존 카드 타입이며 서버에서 날짜별 카드 복제나 잘라낸 가짜 날짜를 만들지 않는다.
- 날짜 겹침은 `COALESCE(start_date,due_date) <= to AND due_date >= from`. 월 이전에 시작하거나 다음 달에 끝나는 이슈, 조회 기간 전체를 덮는 이슈도 포함한다. 원래 시작/마감일을 그대로 보내 화면에서 기간 막대를 그린다.
- 시작일 없이 마감일만 있으면 점 표시용 데이터다. 마감일 없음·프로젝트 밖·삭제 이슈/저장소·다른 팀/연결 해제 저장소는 제외한다. 닫힌 이슈도 조회하되 DONE·overdue=false다.
- 날짜 판정은 PlanLimits.APP_ZONE(KST)의 오늘을 사용한다. 날짜 자체는 LocalDate이고 UTC 시각으로 바꿔 하루를 이동시키지 않는다.
- 결과의 기술적 안정 순서는 유효 시작일·마감일·내부 ID다. GitHub 보드 수동 순서를 새로 저장하지 않는다. 페이지 나누기나 별도 월/주 API는 만들지 않는다.
- 조회 트랜잭션 안에서 멤버십과 팀 연결을 다시 확인한다. 캘린더 조회는 GitHub 쓰기 권한 호출을 하지 않는다. 날짜 편집은 12번 schedule API를 그대로 쓴다.

## 마감 알림 생산자

- 기존 `IssueSyncSchedule`에 Policy의 09:00 KST cron을 연결한다. `linker.issues.sync-enabled=false` 기본값을 유지하므로 실제 B/캐시 연결 확인 전 자동 활성화하지 않는다. 직접 메서드를 호출해도 KST 9시대 외에는 생산하지 않는다.
- `PlanLimits.ISSUE_DUE_REMINDER_DAYS_BEFORE=1`, `ISSUE_DUE_REMINDER_HOUR=9`는 POL-N-1의 기존 숫자를 코드로 옮긴 것이다.
- ACTIVE/COMPLETED 팀의 연결된 저장소·보드 항목 중 내일 마감인 미완료 이슈가 대상이다. 닫힘·DONE·삭제·기한 없음·프로젝트 밖은 제외한다.
- 수신자는 현재 소속·조직 초대 수락 상태의 개발자 담당자다. 탈퇴/삭제·팀 탈퇴·외부 GitHub 담당자는 제외한다. 기존 auth_identities의 GitHub ID와 연결되고, 현재 사용자 GitHub 로그인에 실제 저장소 읽기 권한이 있는지도 재검증한다. 권한/통신 실패 때는 생산하지 않고 안전한 식별자만 로그에 남긴다.
- GitHub 권한 확인은 DB 트랜잭션 밖이다. 팀 잠금 안에서 짧은 트랜잭션을 열고 계정·멤버십·일정·저장소/팀 연결을 다시 확인해 관련 행의 공유 잠금을 잡는다.
- `issue-due:{team}:{issue}:{dueDate}:{recipient}`별 PostgreSQL transaction advisory lock과 기존 알림 행의 존재 검사를 함께 사용한다. groupKey만으로 중복이 막힌다고 가정하지 않는다. 같은 트랜잭션의 알림 생성이 실패하면 롤백되어 재실행할 수 있다.
- 타입 DUE_SOON, actor=null, targetType=ISSUE, targetId=내부 이슈 ID, linkPath=/teams/{team}/issues/{issue}다. payload의 title/body/dueDate는 D 목록 계약이 표시할 수 있는 값이다. 마감일이나 담당자가 바뀌면 새로운 조합에 대해 알린다.
- 사용자 push_enabled=false여도 인앱 알림은 생성한다. C는 Expo/STOMP를 직접 호출하거나 D의 전달 서비스를 복제하지 않는다.

## D 전달 계약의 현재 한계

최신 dev `NotificationDeliveryService`는 CHAT 주기 발송과 오전 8시 `deliver_after IS NOT NULL`인 비채팅 지연 알림만 처리한다. 09시 DUE_SOON은 정상적으로 deliver_after=null로 생성되므로 인앱 목록에는 보이지만 현재 작업자만으로 Android 푸시 발송을 보장할 수 없다. D의 즉시 비채팅 전달 경로가 후속으로 필요하다. 이 문제를 C가 임의의 deliver_after 값이나 D 서비스 수정으로 우회하지 않는다.

## 검증과 후속

- 관련 테스트 **132개 통과**, 실패·오류·생략 0: 이슈 통합 105개(기존 90 + P15 15), 템플릿 파서 7개, 기타 관련 회귀 20개.
- bootJar 빌드·API 및 웹 typecheck·API 생성 파이프라인 검사 통과.
- 기간 전체를 감싸는 이슈·월/주 경계·단일 날짜·담당자·삭제/다른 팀 제외·KST overdue·필수/잘못된 날짜·권한을 실제 HTTP 응답으로 검증했다.
- 09시 KST, 전날 대상, 인앱 목록 표시, 푸시 꺼짐, 탈퇴/초대 미수락/저장소 권한 상실, 마감일/담당자 변경, 동시 실행, 생성 실패의 롤백/재실행과 중복 방지를 검증했다.
- 필수 날짜 누락이 기존 전역 예외 경로에서 500이 되는 것을 발견했다. UserIssueController 안에서만 MissingServletRequestParameterException을 400 입력 오류로 처리했다.
- 기존 모든 생성 API·Zod/MSW 파일은 유지하고 p15 생성물·새 스키마·barrel만 추가했다. 참조하는 기존 스키마는 TypeScript AST로 의미가 같음을 확인했다.
- 격리 PostgreSQL/Redis·모의 GitHub·실제 Security/Notification 생성 서비스를 사용했다. 자동 Flyway 파일·실제 App·개발/공용 DB에는 쓰지 않았다. 전체 백엔드 테스트·실 GitHub·화면 E2E·Android 실제 푸시는 미검증이다.
- 커밋·push·PR 생성은 하지 않았다. 검토 후 제목 `feat/15-page-api: 15 캘린더 조회·마감 전날 알림 구현 (#94)`, 관련 이슈 `Refs #94`를 사용한다.

- B #217의 실제 팀·권한·보드 연결, C SQL의 정식 Flyway 편입, 실 GitHub App·화면 왕복은 기존 11~14와 같은 후속이다.
- Android 실제 푸시는 위 D 전달 경로 확인 후 검증한다. C의 인앱 생산 검증과 구분한다.
- 관련 이슈는 Refs #94, 실제 연결 검증 전에는 In progress다. 저장소 밖 한국어 WBS 원본에도 P15 설명을 반영해야 한다.

## 푸시 전 추가 확인

최신 dev `37f150a`(#231 채팅 알림)를 충돌 없이 반영했다. 15번 테스트 15개와 관련 회귀 20개, 총 35개가 실패·오류·생략 없이 통과했고 bootJar도 통과했다. 앞의 132개는 cab3858에서 실행한 검증이며, 최신 변경은 15번 중심으로 재검증했다. 새 dev는 frontend를 바꾸지 않아 기존 API·웹 타입 검사 결과를 유지한다. 커밋·push는 하지 않았다.
