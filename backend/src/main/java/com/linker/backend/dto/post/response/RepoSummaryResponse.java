package com.linker.backend.dto.post.response;

public record RepoSummaryResponse(
		long repoId,
		String fullName,
		String description,
		String language,
		int stars,
		int forks,
		boolean isFork,
		String parentFullName,
		int authorCommitCount,
		int handledIssueCount,
		int photoLimit
) {
}
