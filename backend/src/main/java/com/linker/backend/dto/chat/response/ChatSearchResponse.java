package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/** Matching visible text messages, newest first. */
public record ChatSearchResponse(
		@Schema(requiredMode = REQUIRED) List<ChatMessageResponse> items,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "Free-team history limit")
		ChatHistoryLimitResponse history
) {
}
