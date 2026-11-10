package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** One minutes line. Tapping it scrolls to {@code messageId} when that message is loaded. */
public record AiSummaryItemResponse(
		@Schema(requiredMode = REQUIRED) String text,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Source message; null when the model gave none") Long messageId
) {
}
