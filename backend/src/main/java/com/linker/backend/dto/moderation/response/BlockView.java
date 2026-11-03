package com.linker.backend.dto.moderation.response;

import java.time.Instant;

public record BlockView(UserCard user, Instant blockedAt) {

	public record UserCard(long id, String login, String name) {
	}
}
