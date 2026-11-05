package com.linker.backend.integration.github;

import java.io.ByteArrayOutputStream;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.util.Base64;
import java.util.Date;

import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.error.ApiException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

/** GitHub App authentication only. Never reuses A's session signing key. */
@Component
public class GithubAppJwt {
	private final GithubAppProperties properties;
	private final Clock clock;

	public GithubAppJwt(GithubAppProperties properties, Clock clock) {
		this.properties = properties;
		this.clock = clock;
	}

	public String issue() {
		if (properties.id().isBlank() || properties.privateKey().isBlank()) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub App 설정이 필요해요");
		}
		try {
			var now = clock.instant();
			var claims = new JWTClaimsSet.Builder().issuer(properties.id())
					.issueTime(Date.from(now.minusSeconds(60)))
					.expirationTime(Date.from(now.plusSeconds(540))).build();
			SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
			jwt.sign(new RSASSASigner(privateKey(properties.privateKey())));
			return jwt.serialize();
		}
		catch (Exception exception) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub App 설정을 확인해 주세요");
		}
	}

	private RSAPrivateKey privateKey(String pem) throws Exception {
		String normalized = pem.replace("\\n", "\n").replace("\\r", "").trim();
		boolean pkcs1 = normalized.startsWith("-----BEGIN RSA PRIVATE KEY-----");
		String type = pkcs1 ? "RSA PRIVATE KEY" : "PRIVATE KEY";
		String begin = "-----BEGIN " + type + "-----";
		String end = "-----END " + type + "-----";
		if (!normalized.startsWith(begin) || !normalized.endsWith(end)) {
			throw new IllegalArgumentException("Invalid GitHub App PEM");
		}
		byte[] der = Base64.getDecoder().decode(normalized.substring(begin.length(), normalized.length() - end.length()).replaceAll("\\s", ""));
		if (pkcs1) {
			ByteArrayOutputStream body = new ByteArrayOutputStream();
			body.write(new byte[]{2, 1, 0});
			body.write(java.util.HexFormat.of().parseHex("300d06092a864886f70d0101010500"));
			body.write(tag(4, der));
			der = tag(48, body.toByteArray());
		}
		return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
	}

	private byte[] tag(int tag, byte[] body) {
		ByteArrayOutputStream result = new ByteArrayOutputStream();
		result.write(tag);
		if (body.length < 128) {
			result.write(body.length);
		}
		else {
			int lengthBytes = (32 - Integer.numberOfLeadingZeros(body.length) + 7) / 8;
			result.write(128 | lengthBytes);
			for (int i = lengthBytes - 1; i >= 0; i--) {
				result.write(body.length >>> (8 * i));
			}
		}
		result.writeBytes(body);
		return result.toByteArray();
	}
}
