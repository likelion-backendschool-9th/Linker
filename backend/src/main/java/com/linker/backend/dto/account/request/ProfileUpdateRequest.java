package com.linker.backend.dto.account.request;

import java.util.List;

public record ProfileUpdateRequest(
		String name,
		String bio,
		String blogUrl,
		List<String> techStack,
		Boolean lookingForTeam,
		String jobStatus,
		List<String> jobCategories
) {
}
