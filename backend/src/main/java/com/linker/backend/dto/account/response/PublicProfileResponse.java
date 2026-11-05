package com.linker.backend.dto.account.response;

import java.time.Instant;
import java.util.List;

public record PublicProfileResponse(
		long id,
		String login,
		String name,
		String avatarUrl,
		String githubUrl,
		String userType,
		String kind,
		String bio,
		String blogUrl,
		List<String> techStack,
		boolean lookingForTeam,
		String jobStatus,
		long followerCount,
		long followingCount,
		Completion completion,
		Instant joinedAt,
		boolean isMe,
		boolean isFollowing,
		boolean isBlockedByMe,
		String redirectedFrom,
		String company,
		String jobTitle,
		String companyEmailDomain,
		String websiteUrl,
		List<Long> pinnedPostIds
) {

	public record Completion(int projectCount, double issueCompletionRate) {
	}
}
