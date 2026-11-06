package com.linker.backend.global.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.linker.backend.global.config.LinkerProperties;

import org.junit.jupiter.api.Test;

class SessionCookiesTest {

	@Test
	void clearExpiresTheSessionCookie() {
		LinkerProperties properties = new LinkerProperties(
				new LinkerProperties.Session("linker_session", "Lax", true, ".linker.test", "/", 30, "priv", "pub"),
				new LinkerProperties.Security(60, false, "", false),
				new LinkerProperties.Storage("unconfigured", ""),
				new LinkerProperties.Github(""),
				new LinkerProperties.Webhook(false, "queue"),
				new LinkerProperties.Payment("", "", ""),
				new LinkerProperties.Mail("", 1025, "", "", "Linker <noreply@linker.local>", "http://localhost:3000", java.util.List.of()));

		String cleared = new SessionCookies(properties).clear();

		assertThat(cleared).contains("linker_session=");
		assertThat(cleared).contains("Max-Age=0");
		assertThat(cleared).contains("Domain=.linker.test");
		assertThat(cleared).contains("HttpOnly");
		assertThat(cleared).contains("Secure");
		assertThat(cleared).contains("SameSite=Lax");
	}
}
