package com.linker.backend.dto.chat.response;

/**
 * {@code kind} is {@code DIRECT} (open conversation) or {@code REQUEST}. {@code roomId} is null only for
 * a {@code REQUEST} answer to a call without a first message.
 */
public record StartDirectChatResponse(Long roomId, String kind) {

	public static StartDirectChatResponse direct(long roomId) {
		return new StartDirectChatResponse(roomId, "DIRECT");
	}

	public static StartDirectChatResponse request(Long roomId) {
		return new StartDirectChatResponse(roomId, "REQUEST");
	}
}
