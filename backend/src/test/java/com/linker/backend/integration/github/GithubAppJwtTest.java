package com.linker.backend.integration.github;

import static org.assertj.core.api.Assertions.*;

import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;

class GithubAppJwtTest {
	@Test
	void signsWithTheSeparateAppKeyAndBoundedLifetime() throws Exception {
		var generator = KeyPairGenerator.getInstance("RSA");
		generator.initialize(2048);
		var pair = generator.generateKeyPair();
		String pem = "-----BEGIN PRIVATE KEY-----\n" + Base64.getEncoder().encodeToString(pair.getPrivate().getEncoded()) + "\n-----END PRIVATE KEY-----";
		Instant now = Instant.parse("2026-11-05T00:00:00Z");
		var properties = GithubAppProperties.installation("123", "linker", pem, "https://api.github.com", "2026-03-10", Duration.ofSeconds(10), Duration.ofMinutes(10));
		SignedJWT jwt = SignedJWT.parse(new GithubAppJwt(properties, Clock.fixed(now, ZoneOffset.UTC)).issue());
		assertThat(jwt.verify(new RSASSAVerifier((RSAPublicKey) pair.getPublic()))).isTrue();
		assertThat(jwt.getJWTClaimsSet().getIssuer()).isEqualTo("123");
		assertThat(jwt.getJWTClaimsSet().getIssueTime().toInstant()).isEqualTo(now.minusSeconds(60));
		assertThat(jwt.getJWTClaimsSet().getExpirationTime().toInstant()).isBefore(now.plusSeconds(600));
		assertThat(properties.toString()).doesNotContain("PRIVATE KEY");
		// Independently extract the PKCS#1 payload from the JDK PKCS#8 envelope.
		var sequence = new java.io.ByteArrayInputStream(derValue(new java.io.ByteArrayInputStream(pair.getPrivate().getEncoded())));
		derValue(sequence);
		derValue(sequence);
		String pkcs1 = "-----BEGIN RSA PRIVATE KEY-----\n" + Base64.getEncoder().encodeToString(derValue(sequence)) + "\n-----END RSA PRIVATE KEY-----";
		var pkcs1Properties = GithubAppProperties.installation("123", "linker", pkcs1, properties.apiBaseUrl(), properties.apiVersion(), properties.requestTimeout(), properties.stateTtl());
		SignedJWT pkcs1Jwt = SignedJWT.parse(new GithubAppJwt(pkcs1Properties, Clock.fixed(now, ZoneOffset.UTC)).issue());
		assertThat(pkcs1Jwt.verify(new RSASSAVerifier((RSAPublicKey) pair.getPublic()))).isTrue();
	}

	private byte[] derValue(java.io.ByteArrayInputStream input) throws java.io.IOException {
		input.read();
		int length = input.read();
		if ((length & 128) != 0) {
			int bytes = length & 127;
			length = 0;
			while (bytes-- > 0) { length = (length << 8) | input.read(); }
		}
		return input.readNBytes(length);
	}

	@Test
	void absentOrInvalidCredentialsNeverLeakTheirContent() {
		for (String key : new String[]{"", "synthetic-invalid-private-key"}) {
			var properties = GithubAppProperties.installation("123", "linker", key, "https://api.github.com", "2026-03-10", Duration.ofSeconds(10), Duration.ofMinutes(10));
			assertThatThrownBy(() -> new GithubAppJwt(properties, Clock.systemUTC()).issue())
					.isInstanceOf(ApiException.class).hasMessageNotContaining("synthetic");
		}
	}
}
