package com.linker.backend.dto.recruit.response;

public record MyApplicationBriefResponse(
		long id,
		String status,
		long roleId,
		Long teamChatRoomId
) {
}
