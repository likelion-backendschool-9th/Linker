package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Base64;

import com.linker.backend.global.config.GithubAppProperties;

import org.junit.jupiter.api.Test;

class GithubTokenCipherTest {

	@Test
	void roundTripsWithoutStoringTheRawToken() {
		byte[] raw = new byte[32];
		raw[0] = 7;
		String encoded = Base64.getEncoder().encodeToString(raw);
		GithubTokenCipher cipher = new GithubTokenCipher(properties(encoded));
		String stored = cipher.encrypt("ghu_test");
		assertThat(stored).doesNotContain("ghu_test");
		assertThat(cipher.decrypt(stored)).isEqualTo("ghu_test");
		assertThat(GithubTokenCipher.usable(encoded)).isTrue();
		assertThat(GithubTokenCipher.usable("")).isFalse();
		assertThat(GithubTokenCipher.usable(Base64.getEncoder().encodeToString(new byte[16]))).isFalse();
	}

	@Test
	void authorizeUrlKeepsTheSecretOutAndUsesTheAppCallback() {
		String web = GithubAuthorizeUrls.build("https://github.com", "Iv1.test", "https://app.example/auth/callback", "state");
		assertThat(web).startsWith("https://github.com/login/oauth/authorize?");
		assertThat(web).contains("client_id=Iv1.test").contains("allow_signup=false").doesNotContain("secret");
		assertThat(GithubAuthorizeUrls.redirectUri("https://app.example/auth/callback", "app"))
				.isEqualTo("https://app.example/auth/callback?client=app");
		assertThat(GithubAuthorizeUrls.callbackUrl("https://app.example/auth/callback")).isTrue();
		assertThat(GithubAuthorizeUrls.callbackUrl("https://app.example/auth/callback?client=app")).isFalse();
	}

	private static GithubAppProperties properties(String key) {
		return new GithubAppProperties("", "", "", "https://api.github.com", "2026-03-10",
				Duration.ofSeconds(10), Duration.ofMinutes(10), "", "", "", "https://github.com", key);
	}
}
