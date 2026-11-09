package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** Team of a team room, as the caller sees it. {@code myRole} drives other-message delete and @all. */
public record ChatRoomTeamResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED) String name,
		@Schema(requiredMode = REQUIRED, allowableValues = {"ACTIVE", "COMPLETED", "READ_ONLY", "ARCHIVED"}) String status,
		@Schema(requiredMode = REQUIRED, allowableValues = {"OWNER", "ADMIN", "MEMBER"}) String myRole,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Team photo") String avatarUrl,
		@Schema(requiredMode = REQUIRED, description = "Owner team setting for AI summary") boolean aiSummaryEnabled,
		@Schema(requiredMode = REQUIRED, description = "Show「이 팀은 AI 요약을 사용해요」banner (first 7 days)") boolean aiSummaryBanner
) {
}
