package com.linker.backend.integration.github;

import java.time.Instant;

public record GithubUserSession(
		String accessToken,
		Instant accessExpiresAt,
		String refreshToken,
		Instant refreshExpiresAt
) {
}
