package com.linker.backend.dto.auth.response;

import java.time.Instant;

public record MeResponse(
		long userId,
		String login,
		String userType,
		boolean isAdmin,
		String status,
		boolean onboarded,
		Instant suspendedUntil,
		/** {@code users.avatar_url}; null when the account has no photo (bottom 프로필 tab falls back to an icon). */
		String avatarUrl
) {
}
