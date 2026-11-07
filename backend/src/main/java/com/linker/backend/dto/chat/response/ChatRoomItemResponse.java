package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

public record ChatRoomItemResponse(
		@Schema(requiredMode = REQUIRED) long id,
		@Schema(requiredMode = REQUIRED, allowableValues = {"TEAM", "DIRECT", "REQUEST"}) String kind,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "TEAM: team name. 1:1: counterpart name") String title,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}) ChatCounterpartResponse counterpart,
		@Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {"GENERAL", "RECRUITING"}) String requestKind,
		@Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {"SENT", "RECEIVED"}) String requestDirection,
		@Schema(requiredMode = REQUIRED, nullable = true, description = "[Included] recruiting offer company; always null for now") String companyName,
		@Schema(requiredMode = REQUIRED) boolean muted,
		@Schema(requiredMode = REQUIRED) long unreadCount,
		@Schema(requiredMode = REQUIRED, types = {"object", "null"}, description = "null when the room has no visible message") ChatLastMessageResponse lastMessage
) {
}
