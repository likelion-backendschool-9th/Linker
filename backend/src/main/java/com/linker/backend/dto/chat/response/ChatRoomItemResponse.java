package com.linker.backend.dto.chat.response;

public record ChatRoomItemResponse(
		long id,
		String kind,
		String title,
		ChatCounterpartResponse counterpart,
		String requestKind,
		String requestDirection,
		String companyName,
		boolean muted,
		long unreadCount,
		ChatLastMessageResponse lastMessage
) {
}
