package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** Page 17 room info member. {@code role} is the team role in a team room and null in a 1:1 room. */
public record ChatRoomMemberResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "null for a withdrawn account") String login,
		@Schema(requiredMode = REQUIRED, description = "Display name, or the withdrawn placeholder") String name,
		@Schema(requiredMode = REQUIRED, nullable = true) String avatarUrl,
		@Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {"OWNER", "ADMIN", "MEMBER"}, description = "Team role; null in a 1:1 room") String role
) {
}
