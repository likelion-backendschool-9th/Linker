package com.linker.backend.dto.notification.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;

public record NotificationItemResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED, description = "notifications.notification_type, e.g. CHAT, CHAT_MENTION, MESSAGE_REQUEST, TEAM_INVITE, SANCTION") String type,
		@Schema(requiredMode = REQUIRED, description = "Stored title, or a generic line when the row has none") String title,
		@Schema(requiredMode = REQUIRED, nullable = true) String body,
		@Schema(requiredMode = REQUIRED, description = "In-app path; empty when the row has no destination") String targetUrl,
		@Schema(requiredMode = REQUIRED) boolean read,
		@Schema(requiredMode = REQUIRED) Instant createdAt,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "Only on the caller's own sanction notification") AppealState appeal
) {
	public record AppealState(
			@Schema(requiredMode = REQUIRED) long sanctionId,
			@Schema(requiredMode = REQUIRED) boolean submitted
	) {
	}
}
