package com.linker.backend.integration.github;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;

import org.springframework.stereotype.Component;

/** AES-GCM for GitHub user tokens. The raw token never leaves the server. */
@Component
public class GithubTokenCipher {

	private static final int IV_BYTES = 12;
	private static final int TAG_BITS = 128;
	private static final SecureRandom RANDOM = new SecureRandom();

	private final SecretKeySpec key;

	public GithubTokenCipher(GithubAppProperties properties) {
		this.key = key(properties.tokenEncryptionKey());
	}

	public static boolean usable(String encoded) {
		return key(encoded) != null;
	}

	public String encrypt(String raw) {
		if (key == null) {
			throw unconfigured();
		}
		byte[] iv = new byte[IV_BYTES];
		RANDOM.nextBytes(iv);
		try {
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
			byte[] body = cipher.doFinal(raw.getBytes(StandardCharsets.UTF_8));
			byte[] packed = new byte[iv.length + body.length];
			System.arraycopy(iv, 0, packed, 0, iv.length);
			System.arraycopy(body, 0, packed, iv.length, body.length);
			return Base64.getEncoder().encodeToString(packed);
		}
		catch (GeneralSecurityException exception) {
			throw unconfigured();
		}
	}

	public String decrypt(String encoded) {
		if (key == null || encoded == null || encoded.isBlank()) {
			throw unconfigured();
		}
		try {
			byte[] packed = Base64.getDecoder().decode(encoded);
			if (packed.length <= IV_BYTES) {
				throw unconfigured();
			}
			byte[] iv = new byte[IV_BYTES];
			System.arraycopy(packed, 0, iv, 0, IV_BYTES);
			Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
			cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
			byte[] body = cipher.doFinal(packed, IV_BYTES, packed.length - IV_BYTES);
			return new String(body, StandardCharsets.UTF_8);
		}
		catch (GeneralSecurityException | IllegalArgumentException exception) {
			throw unconfigured();
		}
	}

	private static SecretKeySpec key(String encoded) {
		if (encoded == null || encoded.isBlank()) {
			return null;
		}
		try {
			byte[] decoded = Base64.getDecoder().decode(encoded.trim());
			if (decoded.length != 32) {
				return null;
			}
			return new SecretKeySpec(decoded, "AES");
		}
		catch (IllegalArgumentException exception) {
			return null;
		}
	}

	private static ApiException unconfigured() {
		return new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 로그인 연결이 아직 준비되지 않았어요");
	}
}
