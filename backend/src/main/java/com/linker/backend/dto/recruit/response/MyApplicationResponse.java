package com.linker.backend.dto.recruit.response;

public record MyApplicationResponse(
		long id,
		String status,
		String appliedAt,
		String roleName,
		RecruitCardResponse recruit,
		Long teamChatRoomId
) {
}
