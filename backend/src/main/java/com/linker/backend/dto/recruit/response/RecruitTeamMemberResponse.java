package com.linker.backend.dto.recruit.response;

public record RecruitTeamMemberResponse(
		long id,
		String login,
		String name,
		String avatarUrl,
		String teamRole,
		boolean isAuthor
) {
}
