package com.linker.backend.dto.account.response;

public record SettingsResponse(
		Github github,
		String notificationEmail,
		boolean pushEnabled,
		Plan plan
) {
	public record Github(String login, boolean connected) {
	}

	/** Paid period and {@code renewsOn} arrive with subscription checkout. */
	public record Plan(String name, String label, String kind) {
	}
}
