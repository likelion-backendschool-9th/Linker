package com.linker.backend.dto.github.response;

public record GithubInstallationView(long installationId, long orgId, String login, String avatarUrl) {
}
