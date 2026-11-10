package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.global.config.LinkerProperties;
import com.linker.backend.global.error.ApiException;

import org.junit.jupiter.api.Test;

class GithubWebhookSignatureVerifierTest {

	@Test
	void rejectsAMissingSecretWithoutAcceptingTheBody() {
		GithubWebhookSignatureVerifier verifier = verifier("");

		assertThatThrownBy(() -> verifier.verify("{}".getBytes(StandardCharsets.UTF_8), "sha256=00"))
				.isInstanceOf(ApiException.class)
				.extracting("code")
				.isEqualTo("SERVICE_UNAVAILABLE");
	}

	@Test
	void rejectsABadSignature() throws Exception {
		GithubWebhookSignatureVerifier verifier = verifier("test-secret");
		byte[] body = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);

		assertThatThrownBy(() -> verifier.verify(body, "sha256=" + "ab".repeat(32)))
				.isInstanceOf(ApiException.class)
				.extracting("code")
				.isEqualTo("UNAUTHORIZED");

		verifier.verify(body, "sha256=" + sign(body));
	}

	private static String sign(byte[] body) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		mac.init(new SecretKeySpec("test-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
		return HexFormat.of().formatHex(mac.doFinal(body));
	}

	private static GithubWebhookSignatureVerifier verifier(String secret) {
		return new GithubWebhookSignatureVerifier(new LinkerProperties(
				new LinkerProperties.Session("linker_session", "Lax", false, "", "/", 30, "", ""),
				new LinkerProperties.Security(60, false, "", false),
				new LinkerProperties.Storage("local", ""),
				new LinkerProperties.Github(secret),
				new LinkerProperties.Webhook(false, "linker:github:webhook"),
				new LinkerProperties.Payment("", "", "https://api.tosspayments.com"),
				new LinkerProperties.Mail("", 1025, "", "", "Linker <noreply@linker.local>", "http://localhost:3000", java.util.List.of())
		));
	}
}
