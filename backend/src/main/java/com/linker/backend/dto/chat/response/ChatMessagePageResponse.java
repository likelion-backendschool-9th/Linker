package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * {@code items} are ascending by message id.
 * {@code hasMore} means another batch exists in that direction.
 * {@code catchUpLimited} is true only when an {@code after} query stopped at the catch-up cap.
 * {@code nextAfter} is the newest returned id when that cap left a further batch.
 */
public record ChatMessagePageResponse(
		@Schema(requiredMode = REQUIRED) List<ChatMessageResponse> items,
		@Schema(requiredMode = REQUIRED) boolean hasMore,
		@Schema(requiredMode = REQUIRED) boolean catchUpLimited,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Continue the catch-up with after=nextAfter") Long nextAfter,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "Team rooms only") ChatHistoryLimitResponse history
) {
}
