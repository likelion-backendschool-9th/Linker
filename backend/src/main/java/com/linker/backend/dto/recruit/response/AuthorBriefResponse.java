package com.linker.backend.dto.recruit.response;

public record AuthorBriefResponse(
		long id,
		String login,
		String name,
		String avatarUrl,
		String userType,
		String jobStatus,
		/** Feed cards only; false elsewhere / for guests. */
		boolean isFollowing
) {
}
