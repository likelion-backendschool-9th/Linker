package com.linker.backend.dto.github.response;

public record VerifyInstallationResponse(String result, Organization org, String installationId) {
	public record Organization(long id, String login, String avatarUrl) {
	}
}
