package com.linker.backend.dto.chat.response;

public record ChatShareCardResponse(
		String targetType,
		long targetId,
		String title,
		String summary,
		String imageUrl,
		String linkPath,
		boolean available
) {
	public static ChatShareCardResponse unavailable(String targetType, long targetId) {
		return new ChatShareCardResponse(
				targetType, targetId, "볼 수 없는 게시물이에요", null, null, null, false
		);
	}
}
