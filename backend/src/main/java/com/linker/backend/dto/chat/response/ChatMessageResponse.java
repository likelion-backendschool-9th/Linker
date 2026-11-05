package com.linker.backend.dto.chat.response;

import java.time.Instant;
import java.util.List;

public record ChatMessageResponse(
		long id,
		long roomId,
		long unreadCount,
		String clientMessageId,
		ChatMemberResponse sender,
		String type,
		String text,
		List<String> imageUrls,
		Object payload,
		Instant createdAt,
		Instant editedAt,
		Instant deletedAt,
		String visibility
) {
}
