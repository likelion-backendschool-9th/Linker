package com.linker.backend.domain.github;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.global.error.ApiException;

import org.springframework.stereotype.Component;
import com.linker.backend.global.config.LinkerProperties;

@Component
public class GithubWebhookSignatureVerifier {

	private final String secret;

	public GithubWebhookSignatureVerifier(LinkerProperties properties) {
		this.secret = properties.github().webhookSecret() == null ? "" : properties.github().webhookSecret();
	}

	public void verify(byte[] body, String signatureHeader) {
		if (secret.isBlank()) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 웹훅 비밀키가 설정되지 않았어요");
		}
		if (signatureHeader == null || !signatureHeader.startsWith("sha256=") || signatureHeader.length() != "sha256=".length() + 64) {
			throw unauthorized();
		}
		byte[] given;
		try {
			given = HexFormat.of().parseHex(signatureHeader.substring("sha256=".length()));
		}
		catch (IllegalArgumentException exception) {
			throw unauthorized();
		}
		byte[] expected = hmac(body);
		if (!MessageDigest.isEqual(expected, given)) {
			throw unauthorized();
		}
	}

	private byte[] hmac(byte[] body) {
		try {
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return mac.doFinal(body);
		}
		catch (NoSuchAlgorithmException | InvalidKeyException exception) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요");
		}
	}

	private ApiException unauthorized() {
		return new ApiException(401, "UNAUTHORIZED", "서명이 올바르지 않아요");
	}
}
