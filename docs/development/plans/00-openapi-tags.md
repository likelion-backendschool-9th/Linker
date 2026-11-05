# 00 OpenAPI 태그

> 2026-11-05. 이슈 [#195](https://github.com/likelion-backendschool-9th/Linker/issues/195). 코드를 페이지 API로 늘리지 않고, 이미 있는 컨트롤러만 `/v3/api-docs`에 공개한다.  
> 변경은 이 문서와 연결 이슈에 적고 전원 멘션 후 반영한다. 태그 이름을 바꾸면 orval 생성 파일 경로가 바뀐다.

## 1. 태그 규칙

태그는 메서드에 붙인다. 한 컨트롤러가 나중에 여러 페이지를 가져도 메서드마다 태그를 유지한다.

| 시점 | 태그 |
| --- | --- |
| 지금 공개된 00 엔드포인트 | `p00-common` |
| 이후 페이지 엔드포인트 | 그 페이지의 `pNN-…`. 청사진 §2-1·§13 |

orval은 `tags-split`이다. `p00-common`은 `frontend/packages/api/src/generated/p00-common/`이다. 페이지 mock 파일은 지우지 않는다.

설치 URL·설치 검증은 WBS 페이지 열이 08이지만, 00 스파이크로 먼저 공개되어 지금은 `p00-common`이다. `p08-…`로 옮기려면 전원 멘션 후 orval을 다시 생성한다.

## 2. 공개 범위

`GET /v3/api-docs`만 연다. Swagger UI는 넣지 않는다. 스캔은 `controller`와 `integration.github`이고, 경로는 `/api/v1/**`이다.

| operationId | 메서드와 경로 | 성공 |
| --- | --- | --- |
| `refreshSession` | `POST /api/v1/public/auth/refresh` | 204 |
| `listTechTags` | `GET /api/v1/public/tech-tags` | 200 |
| `listJobCategories` | `GET /api/v1/public/job-categories` | 200 |
| `listSitemap` | `GET /api/v1/public/sitemap/{kind}` | 200 |
| `getMe` | `GET /api/v1/user/me` | 200 |
| `createUpload` | `POST /api/v1/user/uploads` | 201 |
| `completeUpload` | `POST /api/v1/user/uploads/{fileId}/complete` | 200 |
| `listBlocks` | `GET /api/v1/user/me/blocks` | 200 |
| `createBlock` | `POST /api/v1/user/blocks` | 204 |
| `deleteBlock` | `DELETE /api/v1/user/blocks/{userId}` | 204 |
| `createReport` | `POST /api/v1/user/reports` | 204 |
| `getInstallUrl` | `GET /api/v1/user/team-setup/install-url` | 200 |
| `verifyInstallation` | `POST /api/v1/user/team-setup/installations/verify` | 200 |
| `receiveGithubWebhook` | `POST /api/v1/webhook/github` | 200 중복, 202 접수 |

페이지 07 팀 목록은 `p07-workspace`로 공개한다. operationId는 `getMyTeams`, 경로는 `GET /api/v1/user/me/teams`다. items의 필수 필드·nullable은 서버 스펙을 따른다. C의 내 이슈 API는 이 변경에 포함하지 않는다.

페이지 16 목록은 `p16-chat-list`로 공개한다. operationId는 `listChatRooms`, `unreadChatSummary`, `acceptChatRequest`, `deleteChatRequest`다. 삭제는 204다.

페이지 17은 `p17-chat-room`이다. operationId는 `listChatMessages`, `markChatRead`, `editChatMessage`, `deleteChatMessage`, `listUnreadChatMembers`, `updateChatNotification`이다. 읽음·삭제·음소거는 204다. 방 정보 GET은 아직 없다. STOMP SEND와 토픽 이벤트는 스펙에 넣지 않는다. 토픽 이벤트는 `MESSAGE`, `EDIT`, `DELETE`, `READ`다. 본인 큐는 `CHAT_ROOMS_CHANGED`, `CHAT_SEND_REJECTED`, `CHAT_SEND_ACCEPTED`다.

페이지 03 약관은 `p03-legal`로 공개한다. operationId는 `listLegalDocuments`, `getLegalDocument`다. 목록은 `{slug, title, version, effectiveDate}`이고 본문 조회는 같은 필드에 `body`를 더한다. 로그인이 필요 없다.

페이지 06 로그아웃은 `p06-settings`다. operationId는 `logout`이고 `POST /api/v1/user/auth/logout`은 204다. 현재 세션의 `revoked_at`을 찍고 `linker_session` 쿠키를 지운다. 푸시 토큰 삭제는 이 API에 넣지 않는다.

페이지 06 설정 조회·변경도 `p06-settings`다. `getSettings`는 `github`, `notificationEmail`, `pushEnabled`, `plan`이다. 구독 행이 생기기 전에는 `plan`이 `{name:"FREE", label:"무료", kind:"FREE"}`이고 `renewsOn`은 없다. `updateNotificationEmail`은 `{email}`을 받아 `{notificationEmail}`을 준다. `updatePushNotifications`는 `{pushEnabled}`로 `users.push_enabled`만 바꾼다. `getWithdrawalCheck`는 `{ownedTeams:[{id,name}]}`이고 현재 오너인 팀만 담는다. `withdrawAccount`는 오너 팀이 있으면 409 `OWNED_TEAMS_EXIST`다. 없으면 탈퇴 대기로 바꾸고 세션을 닫으며 `{deletesOn}`은 요청일부터 30일 뒤 날짜다.

페이지 18 헤더 배지는 `p18-notifications`다. operationId는 `getUnreadNotificationCount`이고 `GET /api/v1/user/notifications/unread-count`는 `{count}`다. `read_at`이 없고, `deliver_after`가 비었거나 이미 지난 행만 센다. 목록·읽음 처리는 아직 없다.

페이지 02 온보딩은 `p02-onboarding`이다. operationId는 `getOnboarding`, `acceptOnboardingAgreements`, `saveOnboardingProfile`, `saveOnboardingEmail`이다. 동의와 이메일은 204다. 프로필 저장도 204이고, 응답에서 `onb=true` 쿠키를 다시 발급한다. 이메일 저장은 GitHub 이메일이 없을 때만 의미가 있다.

페이지 03 약관은 `p03-legal`로 공개한다. operationId는 `listLegalDocuments`, `getLegalDocument`다. 목록은 `{slug, title, version, effectiveDate}`이고 본문 조회는 같은 필드에 `body`를 더한다. 로그인이 필요 없다.

페이지 06 로그아웃은 `p06-settings`다. operationId는 `logout`이고 `POST /api/v1/user/auth/logout`은 204다. 현재 세션의 `revoked_at`을 찍고 `linker_session` 쿠키를 지운다. 푸시 토큰 삭제는 이 API에 넣지 않는다.

페이지 06 설정 조회·변경도 `p06-settings`다. `getSettings`는 `github`, `notificationEmail`, `pushEnabled`, `plan`이다. 구독 행이 생기기 전에는 `plan`이 `{name:"FREE", label:"무료", kind:"FREE"}`이고 `renewsOn`은 없다. `updateNotificationEmail`은 `{email}`을 받아 `{notificationEmail}`을 준다. `updatePushNotifications`는 `{pushEnabled}`로 `users.push_enabled`만 바꾼다. `getWithdrawalCheck`는 `{ownedTeams:[{id,name}]}`이고 현재 오너인 팀만 담는다. `withdrawAccount`는 오너 팀이 있으면 409 `OWNED_TEAMS_EXIST`다. 없으면 탈퇴 대기로 바꾸고 세션을 닫으며 `{deletesOn}`은 요청일부터 30일 뒤 날짜다.

페이지 18 헤더 배지는 `p18-notifications`다. operationId는 `getUnreadNotificationCount`이고 `GET /api/v1/user/notifications/unread-count`는 `{count}`다. `read_at`이 없고, `deliver_after`가 비었거나 이미 지난 행만 센다. 목록·읽음 처리는 아직 없다.

페이지 05 프로필 수정은 `p05-profile-edit`다. operationId는 `getMyProfile`, `updateMyProfile`다. 개발자만 호출한다. 조회와 저장은 `kind`, `name`, `bio`, `blogUrl`, `techStack`, `lookingForTeam`, `jobStatus`, `jobCategories`다. 관심 직군은 아직 저장하지 않으므로 `jobCategories`는 빈 배열이다. GitHub 다시 불러오기는 사용자 토큰이 이 줄에 합쳐진 뒤에 둔다.

페이지 04 공개 프로필은 `p04-profile`이다. operationId는 `getPublicProfile`, `listFollowers`, `listFollowings`, `followUser`, `unfollowUser`다. 공개 조회는 로그인 쿠키가 있으면 팔로우 관계와 구직 표시를 포함하고 `Cache-Control: no-store`다. 차단 관계면 404 `볼 수 없는 프로필`이다. 팔로우와 언팔로우는 204이고 개발자만 호출한다. 팔로우는 서울 기준 하루 200명까지이며, 새 팔로우만 `FOLLOW` 알림을 만든다. 완료 기록은 09 테이블 전에 0이다.

페이지 02 온보딩은 `p02-onboarding`이다. operationId는 `getOnboarding`, `acceptOnboardingAgreements`, `saveOnboardingProfile`, `saveOnboardingEmail`이다. 동의와 이메일은 204다. 프로필 저장도 204이고, 응답에서 `onb=true` 쿠키를 다시 발급한다. 이메일 저장은 GitHub 이메일이 없을 때만 의미가 있다.

`PUT /api/v1/user/uploads/{fileId}/content`는 스펙에 없다. WBS 업로드 API 2개에 없고, OpenAPI 포함 여부는 E 확인 전이다. STOMP와 테스트용 프로브 경로도 스펙에 없다.

## 3. 필드 비교

서버 필드명이 기준이다. 페이지 mock은 이 단계에서 고치지 않았다.

같은 이름:

- `MeResponse`: `userId`, `login`, `userType`, `isAdmin`, `status`, `onboarded`, `suspendedUntil`. `Session`과 `p00-common` mock과 같다.
- 기술 태그 `{id, name}`, 직군 `{key, label}`.
- 업로드 생성 `{fileId, uploadUrl}`, 완료 `{fileId, url}`.
- 사이트맵 `{kind, page, items: [{id, url, updatedAt}]}`.
- 차단 생성 본문 `{userId}`. 해제는 경로의 `userId`.

다른 부분:

- 차단 목록의 `user`는 서버가 `{id, login, name}`이다. mock `brief()`는 `avatarUrl`, `userType`, `jobStatus`를 더 준다.
- 신고 본문은 `targetType`, `targetId`, `reason`, `detail`이다. `targetId`의 자바 타입이 `Object`라 스펙 타입은 `unknown`이다.
- 설치 URL `{installUrl, state}`, 설치 검증 요청 `{installationId, state, setupAction}`, 응답 `{result, org: {id, login, avatarUrl}, installationId}`는 페이지 mock이 없다.
- 웹훅은 프론트 mock이 없다. 본문은 현재 서명의 바이트 배열이다.
