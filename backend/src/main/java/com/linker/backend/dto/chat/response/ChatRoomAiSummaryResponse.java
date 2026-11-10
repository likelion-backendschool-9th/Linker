package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * The caller's latest unshared summary in this team room, so the "AI 채팅 요약" ring resumes after
 * leaving the room. Absent once it is shared, expired, or replaced by a newer summary.
 */
public record ChatRoomAiSummaryResponse(
		@Schema(requiredMode = REQUIRED) long summaryId,
		@Schema(requiredMode = REQUIRED, allowableValues = {"PENDING", "DONE", "FAILED"}) String status
) {
}
