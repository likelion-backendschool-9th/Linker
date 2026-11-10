package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record UnreadSummaryResponse(
		@Schema(requiredMode = REQUIRED) long TEAM,
		@Schema(requiredMode = REQUIRED) long DIRECT,
		@Schema(requiredMode = REQUIRED) long REQUEST,
		@Schema(requiredMode = REQUIRED, description = "Received, unexpired requests") long requestCount,
		@Schema(requiredMode = REQUIRED) long total
) {
}
