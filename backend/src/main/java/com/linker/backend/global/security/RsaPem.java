package com.linker.backend.global.security;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

final class RsaPem {

	private RsaPem() {
	}

	static RSAPrivateKey privateKey(String pem) {
		byte[] der = der(pem, "PRIVATE KEY", "JWT_PRIVATE_KEY");
		try {
			return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
		}
		catch (GeneralSecurityException | ClassCastException exception) {
			throw new IllegalStateException("JWT_PRIVATE_KEY is not a PKCS#8 RSA PEM");
		}
	}

	static RSAPublicKey publicKey(String pem) {
		byte[] der = der(pem, "PUBLIC KEY", "JWT_PUBLIC_KEY");
		try {
			return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
		}
		catch (GeneralSecurityException | ClassCastException exception) {
			throw new IllegalStateException("JWT_PUBLIC_KEY is not an SPKI RSA PEM");
		}
	}

	private static byte[] der(String pem, String type, String name) {
		if (pem == null || pem.isBlank()) {
			throw new IllegalStateException(name + " is required");
		}
		String normalized = pem.trim().replace("\\n", "\n").replace("\\r", "");
		String begin = "-----BEGIN " + type + "-----";
		String end = "-----END " + type + "-----";
		int start = normalized.indexOf(begin);
		int finish = normalized.indexOf(end);
		if (start < 0 || finish <= start) {
			throw new IllegalStateException(name + " is not a PEM");
		}
		String body = normalized.substring(start + begin.length(), finish).replaceAll("\\s", "");
		try {
			return Base64.getDecoder().decode(body);
		}
		catch (IllegalArgumentException exception) {
			throw new IllegalStateException(name + " is not a PEM");
		}
	}
}
