package com.linker.backend.dto.notification.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public record NotificationPageResponse(
		@Schema(requiredMode = REQUIRED) List<NotificationItemResponse> items,
		@Schema(requiredMode = REQUIRED, nullable = true) String nextCursor
) {
}
