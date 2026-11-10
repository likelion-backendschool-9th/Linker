package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatLastMessageResponse(
		@Schema(requiredMode = REQUIRED, description = "Message id; the list's 읽음 처리 sends it as lastReadMessageId") long id,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Preview text; null for an image-only message") String text,
		@Schema(requiredMode = REQUIRED) Instant createdAt
) {
}
