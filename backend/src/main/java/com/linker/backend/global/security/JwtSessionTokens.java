package com.linker.backend.global.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.linker.backend.global.config.LinkerProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import org.springframework.stereotype.Component;

@Component
public class JwtSessionTokens {

	private static final Duration CLOCK_LEEWAY = Duration.ofSeconds(60);
	private static final Set<String> MEMBER_TYPES = Set.of("DEVELOPER", "RECRUITER");
	private static final Set<String> ROUTING_STATUSES = Set.of("ACTIVE", "SUSPENDED", "WITHDRAWING");

	private final RSASSASigner signer;
	private final RSASSAVerifier verifier;

	public JwtSessionTokens(LinkerProperties properties) {
		this.signer = new RSASSASigner(RsaPem.privateKey(properties.session().jwtPrivateKey()));
		this.verifier = new RSASSAVerifier(RsaPem.publicKey(properties.session().jwtPublicKey()));
	}

	public String sign(SessionClaims claims, Instant expiresAt) {
		JWTClaimsSet set = new JWTClaimsSet.Builder()
				.subject(claims.subject())
				.jwtID(UUID.randomUUID().toString())
				.claim("typ", claims.memberType())
				.claim("adm", claims.operator())
				.claim("onb", claims.onboarded())
				.claim("st", claims.status())
				.issueTime(Date.from(Instant.now()))
				.expirationTime(Date.from(expiresAt))
				.build();
		try {
			SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).build(), set);
			jwt.sign(signer);
			return jwt.serialize();
		}
		catch (JOSEException exception) {
			throw new IllegalStateException("Could not sign the session JWT");
		}
	}

	public Optional<SessionClaims> verify(String raw) {
		if (raw == null || raw.isBlank()) {
			return Optional.empty();
		}
		try {
			SignedJWT jwt = SignedJWT.parse(raw);
			if (!jwt.verify(verifier)) {
				return Optional.empty();
			}
			JWTClaimsSet set = jwt.getJWTClaimsSet();
			Date expiration = set.getExpirationTime();
			if (expiration == null || expiration.toInstant().plus(CLOCK_LEEWAY).isBefore(Instant.now())) {
				return Optional.empty();
			}
			String subject = set.getSubject();
			String memberType = set.getStringClaim("typ");
			Boolean operator = set.getBooleanClaim("adm");
			Boolean onboarded = set.getBooleanClaim("onb");
			String status = set.getStringClaim("st");
			if (subject == null || subject.isBlank()
					|| !MEMBER_TYPES.contains(memberType)
					|| operator == null
					|| onboarded == null
					|| !ROUTING_STATUSES.contains(status)) {
				return Optional.empty();
			}
			return Optional.of(new SessionClaims(subject, memberType, operator, onboarded, status));
		}
		catch (Exception exception) {
			return Optional.empty();
		}
	}
}
