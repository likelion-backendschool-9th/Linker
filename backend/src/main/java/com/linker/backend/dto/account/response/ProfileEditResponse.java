package com.linker.backend.dto.account.response;

import java.util.List;

public record ProfileEditResponse(
		String kind,
		String name,
		String bio,
		String blogUrl,
		List<String> techStack,
		boolean lookingForTeam,
		String jobStatus,
		List<String> jobCategories
) {
}
