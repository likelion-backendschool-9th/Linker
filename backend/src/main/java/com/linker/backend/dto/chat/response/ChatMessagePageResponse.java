package com.linker.backend.dto.chat.response;

import java.util.List;

/**
 * {@code items} are ascending by message id.
 * {@code hasMore} means another batch exists in that direction.
 * {@code catchUpLimited} is true only when an {@code after} query stopped at the catch-up cap.
 * {@code nextAfter} is the newest returned id when that cap left a further batch.
 */
public record ChatMessagePageResponse(
		List<ChatMessageResponse> items,
		boolean hasMore,
		boolean catchUpLimited,
		Long nextAfter,
		ChatHistoryLimitResponse history
) {
}
