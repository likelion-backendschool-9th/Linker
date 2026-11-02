package com.linker.backend.domain.moderation;

import java.time.Instant;

public record BlockView(UserCard user, Instant blockedAt) {

	public record UserCard(long id, String login, String name) {
	}
}
