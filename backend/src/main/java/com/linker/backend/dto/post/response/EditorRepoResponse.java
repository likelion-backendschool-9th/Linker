package com.linker.backend.dto.post.response;

public record EditorRepoResponse(
		long repoId,
		String fullName,
		String language,
		int stars,
		boolean isFork,
		String parentFullName,
		Long teamId,
		boolean alreadyPosted
) {
}
