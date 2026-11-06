package com.linker.backend.dto.post.response;

public record PostRepoCardResponse(
		long repoId,
		String fullName,
		String description,
		String language,
		int stars,
		int forks,
		boolean isFork,
		String state,
		int authorCommitCount,
		int handledIssueCount
) {
}
