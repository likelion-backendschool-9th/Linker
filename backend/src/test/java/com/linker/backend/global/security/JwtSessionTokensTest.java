package com.linker.backend.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

import com.linker.backend.global.config.LinkerProperties;

import org.junit.jupiter.api.Test;

class JwtSessionTokensTest {

	@Test
	void signsClaimsAndRejectsATamperedToken() {
		RsaMaterial keys = RsaMaterial.generate();
		JwtSessionTokens tokens = new JwtSessionTokens(properties(keys.privatePem(), keys.publicPem()));
		SessionClaims claims = new SessionClaims("7", "DEVELOPER", true, false, "SUSPENDED");

		String raw = tokens.sign(claims, Instant.now().plus(Duration.ofMinutes(5)));

		assertThat(raw.split("\\.")).hasSize(3);
		assertThat(tokens.verify(raw)).contains(claims);
		// Mutate a decoded signature byte; the final Base64 character may differ
		// only in unused padding bits without changing the signature.
		String[] parts = raw.split("\\.");
		byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
		signature[0] ^= 1;
		String tampered = parts[0] + "." + parts[1] + "."
				+ Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
		assertThat(tokens.verify(tampered)).isEmpty();
	}

	@Test
	void acceptsAPemStoredWithNewlineEscapes() {
		RsaMaterial keys = RsaMaterial.generate();
		JwtSessionTokens tokens = new JwtSessionTokens(properties(keys.privatePemEscaped(), keys.publicPemEscaped()));
		SessionClaims claims = new SessionClaims("4", "RECRUITER", false, false, "ACTIVE");

		assertThat(tokens.verify(tokens.sign(claims, Instant.now().plus(Duration.ofMinutes(5))))).contains(claims);
	}

	@Test
	void rejectsAMissingKey() {
		assertThatThrownBy(() -> new JwtSessionTokens(properties("", "")))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("JWT_PRIVATE_KEY");
	}

	private static LinkerProperties properties(String privatePem, String publicPem) {
		return new LinkerProperties(
				new LinkerProperties.Session("linker_session", "Lax", false, "", "/", 30, privatePem, publicPem),
				new LinkerProperties.Security(60, false, "", false),
				new LinkerProperties.Storage("local", ""),
				new LinkerProperties.Github(""),
				new LinkerProperties.Webhook(false, "linker:github:webhook"),
				new LinkerProperties.Payment("", "", "https://api.tosspayments.com"),
				new LinkerProperties.Mail("", 1025, "", "", "Linker <noreply@linker.local>", "http://localhost:3000", java.util.List.of())
		);
	}
}
