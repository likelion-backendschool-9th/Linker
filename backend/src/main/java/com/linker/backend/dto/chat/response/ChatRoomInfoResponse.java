package com.linker.backend.dto.chat.response;

import java.util.List;

/**
 * Page 17 room header. {@code team} and {@code historyLimitDays} stay null until team rooms open.
 */
public record ChatRoomInfoResponse(
		long id,
		String kind,
		String title,
		String requestDirection,
		boolean muted,
		List<ChatMemberResponse> members,
		Object team,
		Integer historyLimitDays
) {
}
