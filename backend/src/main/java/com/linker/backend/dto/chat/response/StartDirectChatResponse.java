package com.linker.backend.dto.chat.response;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * {@code kind} is {@code DIRECT} (open conversation) or {@code REQUEST}. {@code roomId} is null only for
 * a {@code REQUEST} answer to a call without a first message.
 */
public record StartDirectChatResponse(
		@Schema(requiredMode = REQUIRED, nullable = true) Long roomId,
		@Schema(requiredMode = REQUIRED, allowableValues = {"DIRECT", "REQUEST"}) String kind
) {

	public static StartDirectChatResponse direct(long roomId) {
		return new StartDirectChatResponse(roomId, "DIRECT");
	}

	public static StartDirectChatResponse request(Long roomId) {
		return new StartDirectChatResponse(roomId, "REQUEST");
	}
}
