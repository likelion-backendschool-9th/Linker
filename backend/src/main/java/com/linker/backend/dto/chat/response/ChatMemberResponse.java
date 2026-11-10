package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatMemberResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "null for a withdrawn account") String login,
		@Schema(requiredMode = REQUIRED, description = "Display name, or the withdrawn placeholder") String name,
		@Schema(requiredMode = REQUIRED, nullable = true) String avatarUrl
) {
}
