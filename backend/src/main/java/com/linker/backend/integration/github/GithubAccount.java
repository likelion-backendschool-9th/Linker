package com.linker.backend.integration.github;

public record GithubAccount(
		long id,
		String login,
		String name,
		String avatarUrl,
		String email
) {
}
