package com.linker.backend.dto.recruit.response;

public record AcceptApplicationResponse(
		long teamId,
		Long chatRoomId,
		boolean needsGithubInvite
) {
}
