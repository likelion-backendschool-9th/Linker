package com.linker.backend.api.common.auth;

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
