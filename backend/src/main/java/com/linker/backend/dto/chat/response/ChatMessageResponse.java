package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * {@code updatedAt} changes with every edit, delete, hide, unhide and restore. Clients order
 * frames of one message by it: a later {@code updatedAt} wins over an earlier one.
 */
public record ChatMessageResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED) long roomId,
		@Schema(requiredMode = REQUIRED, description = "Other current participants who have not read it") long unreadCount,
		@Schema(requiredMode = REQUIRED, nullable = true) String clientMessageId,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "null for SYSTEM and PR_EVENT") ChatMemberResponse sender,
		@Schema(requiredMode = REQUIRED, allowableValues = {"TEXT", "IMAGE", "ISSUE_CARD", "PR_EVENT", "SYSTEM", "AI_SUMMARY", "SHARE_CARD"}) String type,
		@Schema(requiredMode = REQUIRED, nullable = true) String text,
		@Schema(requiredMode = REQUIRED) List<String> imageUrls,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, implementation = Map.class) Object payload,
		@Schema(requiredMode = REQUIRED) Instant createdAt,
		@Schema(requiredMode = REQUIRED, nullable = true) Instant editedAt,
		@Schema(requiredMode = REQUIRED, nullable = true) Instant deletedAt,
		@Schema(requiredMode = REQUIRED, allowableValues = {"VISIBLE", "HIDDEN"}) String visibility,
		@Schema(requiredMode = REQUIRED, description = "Row version (microseconds); compare to order frames") Instant updatedAt
) {
}
