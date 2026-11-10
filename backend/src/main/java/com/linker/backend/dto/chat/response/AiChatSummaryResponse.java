package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** Page 17 AI summary result (reduced contract: one body string, no minutes sections). */
public record AiChatSummaryResponse(
		@Schema(requiredMode = REQUIRED) long summaryId,
		@Schema(requiredMode = REQUIRED, allowableValues = {"PENDING", "DONE", "FAILED"}) String status,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "ERD summary_line; null while PENDING/FAILED") String summary,
		@Schema(requiredMode = REQUIRED) int messageCount,
		@Schema(requiredMode = REQUIRED) int usedToday,
		@Schema(requiredMode = REQUIRED) int limit,
		@Schema(requiredMode = REQUIRED) String disclaimer
) {
}
