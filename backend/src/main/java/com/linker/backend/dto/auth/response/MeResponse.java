package com.linker.backend.dto.auth.response;

import java.time.Instant;

public record MeResponse(
		long userId,
		String login,
		String userType,
		boolean isAdmin,
		String status,
		boolean onboarded,
		Instant suspendedUntil
) {
}
