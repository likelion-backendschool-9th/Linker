package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatLastMessageResponse(
		@Schema(requiredMode = REQUIRED, nullable = true, description = "Preview text; null for an image-only message") String text,
		@Schema(requiredMode = REQUIRED) Instant createdAt
) {
}
