package com.linker.backend.service.admin;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * RFC 6238 TOTP, 6 digits, 30-second step, HMAC-SHA1, one step of clock skew.
 */
public final class TotpCodes {

	static final int DIGITS = 6;
	static final int STEP_SECONDS = 30;

	private static final int WINDOW = 1;
	private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

	private TotpCodes() {
	}

	public static boolean matches(String base32Secret, String code, Instant now) {
		if (code == null || code.length() != DIGITS || !digits(code)) {
			return false;
		}
		byte[] key;
		try {
			key = decodeBase32(base32Secret);
		}
		catch (IllegalArgumentException exception) {
			return false;
		}
		long counter = now.getEpochSecond() / STEP_SECONDS;
		for (int offset = -WINDOW; offset <= WINDOW; offset++) {
			if (constantTimeEquals(code, at(key, counter + offset))) {
				return true;
			}
		}
		return false;
	}

	/** Current code for tests and enrollment checks. */
	public static String code(String base32Secret, Instant now) {
		return at(decodeBase32(base32Secret), now.getEpochSecond() / STEP_SECONDS);
	}

	static String at(byte[] key, long counter) {
		try {
			Mac mac = Mac.getInstance("HmacSHA1");
			mac.init(new SecretKeySpec(key, "HmacSHA1"));
			byte[] value = new byte[8];
			long remaining = counter;
			for (int index = 7; index >= 0; index--) {
				value[index] = (byte) (remaining & 0xff);
				remaining >>= 8;
			}
			byte[] hash = mac.doFinal(value);
			int offset = hash[hash.length - 1] & 0x0f;
			int binary = ((hash[offset] & 0x7f) << 24)
					| ((hash[offset + 1] & 0xff) << 16)
					| ((hash[offset + 2] & 0xff) << 8)
					| (hash[offset + 3] & 0xff);
			return String.format(Locale.ROOT, "%06d", binary % 1_000_000);
		}
		catch (GeneralSecurityException exception) {
			throw new IllegalStateException("HMAC-SHA1 is unavailable", exception);
		}
	}

	static byte[] decodeBase32(String raw) {
		if (raw == null) {
			throw new IllegalArgumentException("empty");
		}
		String normalized = raw.trim().replace(" ", "").replace("=", "").toUpperCase(Locale.ROOT);
		if (normalized.isEmpty() || normalized.length() > 128) {
			throw new IllegalArgumentException("length");
		}
		int buffer = 0;
		int bits = 0;
		byte[] out = new byte[normalized.length() * 5 / 8];
		int written = 0;
		for (int index = 0; index < normalized.length(); index++) {
			int value = ALPHABET.indexOf(normalized.charAt(index));
			if (value < 0) {
				throw new IllegalArgumentException("alphabet");
			}
			buffer = (buffer << 5) | value;
			bits += 5;
			if (bits >= 8) {
				bits -= 8;
				out[written++] = (byte) ((buffer >> bits) & 0xff);
			}
		}
		byte[] trimmed = new byte[written];
		System.arraycopy(out, 0, trimmed, 0, written);
		return trimmed;
	}

	private static boolean digits(String code) {
		for (int index = 0; index < code.length(); index++) {
			if (code.charAt(index) < '0' || code.charAt(index) > '9') {
				return false;
			}
		}
		return true;
	}

	private static boolean constantTimeEquals(String left, String right) {
		return MessageDigest.isEqual(
				left.getBytes(StandardCharsets.US_ASCII),
				right.getBytes(StandardCharsets.US_ASCII));
	}
}
