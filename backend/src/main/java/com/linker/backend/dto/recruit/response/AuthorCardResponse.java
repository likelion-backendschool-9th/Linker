package com.linker.backend.dto.recruit.response;

public record AuthorCardResponse(
		long id,
		String login,
		String name,
		String avatarUrl,
		String userType,
		String jobStatus,
		String bio
) {
}
