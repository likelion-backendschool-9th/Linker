package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatRoomPageResponse(
		@Schema(requiredMode = REQUIRED) List<ChatRoomItemResponse> items,
		@Schema(requiredMode = REQUIRED, nullable = true) String nextCursor
) {
}
