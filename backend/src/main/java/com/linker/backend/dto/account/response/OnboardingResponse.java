package com.linker.backend.dto.account.response;

import java.util.List;

public record OnboardingResponse(
		boolean done,
		String step,
		Defaults defaults,
		boolean emailRequired,
		String termsVersion
) {
	public record Defaults(
			String name,
			String bio,
			String blogUrl,
			List<String> techStack,
			boolean lookingForTeam,
			String jobStatus
	) {
	}
}
