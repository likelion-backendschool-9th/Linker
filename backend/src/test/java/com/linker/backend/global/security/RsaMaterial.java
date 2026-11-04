package com.linker.backend.global.security;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

public final class RsaMaterial {

	private final String privatePem;
	private final String publicPem;

	private RsaMaterial(String privatePem, String publicPem) {
		this.privatePem = privatePem;
		this.publicPem = publicPem;
	}

	public static RsaMaterial generate() {
		try {
			KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
			generator.initialize(2048);
			KeyPair pair = generator.generateKeyPair();
			return new RsaMaterial(
					pem("PRIVATE KEY", pair.getPrivate().getEncoded()),
					pem("PUBLIC KEY", pair.getPublic().getEncoded())
			);
		}
		catch (Exception exception) {
			throw new IllegalStateException(exception);
		}
	}

	public String privatePem() {
		return privatePem;
	}

	public String publicPem() {
		return publicPem;
	}

	public String privatePemEscaped() {
		return privatePem.replace("\n", "\\n");
	}

	public String publicPemEscaped() {
		return publicPem.replace("\n", "\\n");
	}

	private static String pem(String type, byte[] der) {
		String body = Base64.getMimeEncoder(64, new byte[] {'\n'}).encodeToString(der);
		return "-----BEGIN " + type + "-----\n" + body + "\n-----END " + type + "-----\n";
	}
}
