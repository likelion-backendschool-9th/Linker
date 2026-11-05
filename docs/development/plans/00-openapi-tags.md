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

페이지 16 목록은 `p16-chat-list`로 공개한다. operationId는 `listChatRooms`, `unreadChatSummary`, `acceptChatRequest`, `deleteChatRequest`다. 삭제는 204다. STOMP 경로와 메시지 전송은 스펙에 넣지 않는다.

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
