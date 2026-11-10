package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Page 17 AI summary, one paragraph (POL-C-5). While PENDING, {@code phase}/{@code progress} report the
 * single worker's queue and the model's reading/writing; {@code summary} stays null until DONE.
 */
public record AiChatSummaryResponse(
		@Schema(requiredMode = REQUIRED) long summaryId,
		@Schema(requiredMode = REQUIRED, allowableValues = {"PENDING", "DONE", "FAILED"}) String status,
		@Schema(requiredMode = REQUIRED, allowableValues = {"QUEUED", "READING", "WRITING", "DONE", "FAILED"},
				description = "QUEUED waits for earlier summaries; READING/WRITING are the model's two stages") String phase,
		@Schema(requiredMode = REQUIRED, description = "0–100. An estimate while READING; never 100 before DONE") int progress,
		@Schema(requiredMode = REQUIRED, description = "Summaries ahead in the queue (QUEUED only, else 0)") long queueAhead,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Estimated seconds left; null while QUEUED or when final") Integer remainingSeconds,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "One paragraph (ERD summary_line); null until DONE") String summary,
		@Schema(requiredMode = REQUIRED, description = "Messages read: the latest ones that fit the input budget") int messageCount,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "AI_SUMMARY chat message once shared") Long sharedMessageId,
		@Schema(requiredMode = REQUIRED) int usedToday,
		@Schema(requiredMode = REQUIRED) int limit,
		@Schema(requiredMode = REQUIRED) String disclaimer
) {
}
