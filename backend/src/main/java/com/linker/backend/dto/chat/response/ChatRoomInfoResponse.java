package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/** Page 17 room header. {@code team}, {@code historyLimitDays} and {@code myAiSummary} are set only for a team room. */
public record ChatRoomInfoResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED, allowableValues = {"TEAM", "DIRECT", "REQUEST"}) String kind,
		@Schema(requiredMode = REQUIRED, description = "TEAM: team name. 1:1: counterpart name") String title,
		@Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {"SENT", "RECEIVED"}, description = "REQUEST only") String requestDirection,
		@Schema(requiredMode = REQUIRED) boolean muted,
		@Schema(requiredMode = REQUIRED, description = "TEAM: owner, admins, then members") List<ChatRoomMemberResponse> members,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}) ChatRoomTeamResponse team,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Free team history window in days; null for 1:1") Integer historyLimitDays,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "TEAM only: the caller's latest unshared AI summary") ChatRoomAiSummaryResponse myAiSummary
) {
}
