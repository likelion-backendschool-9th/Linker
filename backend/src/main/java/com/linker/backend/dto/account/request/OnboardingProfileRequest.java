package com.linker.backend.dto.account.request;

import java.util.List;

public record OnboardingProfileRequest(
		String name,
		String bio,
		String blogUrl,
		List<String> techStack,
		boolean lookingForTeam,
		String jobStatus
) {
}
