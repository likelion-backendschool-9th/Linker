package com.linker.backend.dto.team.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record MyTeamsResponse(
		@Schema(requiredMode = REQUIRED) List<TeamItem> items,
		@Schema(requiredMode = REQUIRED) int teamLimit,
		@Schema(requiredMode = REQUIRED) long teamCount,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "개인 소속 팀 전체 목록이므로 다음 커서 없음") String nextCursor
) {
	public record TeamItem(
			@Schema(requiredMode = REQUIRED) long id,
			@Schema(requiredMode = REQUIRED) String name,
			@Schema(requiredMode = REQUIRED, nullable = true) String orgAvatarUrl,
			@Schema(requiredMode = REQUIRED, allowableValues = {"ACTIVE", "COMPLETED", "READ_ONLY", "ARCHIVED"}) String status,
			@Schema(requiredMode = REQUIRED, allowableValues = {"OWNER", "ADMIN", "MEMBER"}) String myRole,
			@Schema(requiredMode = REQUIRED) long memberCount,
			@Schema(requiredMode = REQUIRED) Instant joinedAt,
			@Schema(requiredMode = REQUIRED, nullable = true, description = "본인이 참여한 실제 팀 채팅방. 미연결이면 null") Long chatRoomId,
			@Schema(requiredMode = REQUIRED, nullable = true, description = "구독 조회 연결 전에는 미확인(null). 연결 후 FREE 또는 FLEX") String plan,
			@Schema(requiredMode = REQUIRED, nullable = true, description = "현재 연결 저장소의 캐시상 열린 이슈 수. 캐시 미준비 또는 0건의 초기 동기화 완료를 확인할 수 없으면 null") Long openIssueCount,
			@Schema(requiredMode = REQUIRED, nullable = true, description = "본인 현재 TEAM 채팅방 참여가 있으면 실제 미읽음 수. 연결된 방이 없으면 null") Long unreadCount
	) {
	}
}
