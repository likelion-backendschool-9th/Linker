package com.linker.backend.dto.account.response;

import java.time.Instant;
import java.util.List;

public record GithubProfileSyncResponse(
		String kind,
		String name,
		String bio,
		String blogUrl,
		List<String> techStack,
		boolean lookingForTeam,
		String jobStatus,
		List<String> jobCategories,
		Instant syncedAt
) {
	public static GithubProfileSyncResponse from(ProfileEditResponse profile, Instant syncedAt) {
		return new GithubProfileSyncResponse(
				profile.kind(),
				profile.name(),
				profile.bio(),
				profile.blogUrl(),
				profile.techStack(),
				profile.lookingForTeam(),
				profile.jobStatus(),
				profile.jobCategories(),
				syncedAt);
	}
}
