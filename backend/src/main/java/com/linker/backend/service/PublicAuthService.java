package com.linker.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.JwtSessionTokens;
import com.linker.backend.global.security.SessionClaims;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.moderation.AdminRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.PublicAuthController}.
 * The httpOnly cookie is an RS256 JWT. Only its SHA-256 hash is stored.
 * Screen claims do not grant access; the session row does.
 */
@Service
public class PublicAuthService {

	private static final Duration EXTEND_WHEN_WITHIN = Duration.ofDays(1);
	private static final int MAX_TOKEN_LENGTH = 4096;

	private final UserSessionRepository sessions;
	private final AdminRepository admins;
	private final JwtSessionTokens tokens;

	public PublicAuthService(UserSessionRepository sessions, AdminRepository admins, JwtSessionTokens tokens) {
		this.sessions = sessions;
		this.admins = admins;
		this.tokens = tokens;
	}

	@Transactional
	public String refresh(String rawToken) {
		return rotate(rawToken, Instant.now().plus(Duration.ofDays(PlanLimits.SESSION_DAYS)));
	}

	@Transactional
	public IssuedSession issue(User user, String userAgent, String ip) {
		Instant expiresAt = Instant.now().plus(Duration.ofDays(PlanLimits.SESSION_DAYS));
		String raw = tokens.sign(claims(user), expiresAt);
		UserSession session = sessions.save(UserSession.issue(user, hash(raw), trim(userAgent, 512), trim(ip, 64), expiresAt));
		return new IssuedSession(raw, session.getId());
	}

	@Transactional
	public Optional<AuthenticatedSession> authenticate(String rawToken, boolean slideExpiry) {
		Optional<UserSession> found = active(rawToken);
		if (found.isEmpty()) {
			return Optional.empty();
		}
		UserSession session = found.get();
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			return Optional.empty();
		}
		SessionClaims current = claims(user);
		Optional<SessionClaims> presented = tokens.verify(rawToken);
		Instant expiresAt = session.getExpiresAt();
		boolean extend = false;
		if (slideExpiry) {
			Instant target = Instant.now().plus(Duration.ofDays(PlanLimits.SESSION_DAYS));
			if (session.getExpiresAt().isBefore(target.minus(EXTEND_WHEN_WITHIN))) {
				expiresAt = target;
				user.touch(Instant.now());
				extend = true;
			}
		}
		String renewed = null;
		boolean stale = presented.isEmpty() || !presented.get().equals(current);
		if (slideExpiry && (extend || stale)) {
			renewed = tokens.sign(current, expiresAt);
			session.rotate(hash(renewed), expiresAt);
		}
		return Optional.of(new AuthenticatedSession(toPrincipal(session, user), renewed));
	}

	private String rotate(String rawToken, Instant expiresAt) {
		UserSession session = active(rawToken)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		String renewed = tokens.sign(claims(user), expiresAt);
		session.rotate(hash(renewed), expiresAt);
		user.touch(Instant.now());
		return renewed;
	}

	private Optional<UserSession> active(String rawToken) {
		if (rawToken == null || rawToken.isBlank() || rawToken.length() > MAX_TOKEN_LENGTH || tokens.verify(rawToken).isEmpty()) {
			return Optional.empty();
		}
		return sessions.findActive(hash(rawToken), Instant.now());
	}

	/**
	 * Used by a later operator OTP step. No HTTP API in this step sets the timestamp.
	 */
	@Transactional
	public void markOperatorVerified(long sessionId, Instant when) {
		UserSession session = sessions.findById(sessionId)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		session.markOtpVerified(when);
	}

	/**
	 * Signs the current claims into the existing session and rotates its hash.
	 * Used when onboarding completion changes {@code onb}.
	 */
	@Transactional
	public String reissue(long sessionId) {
		UserSession session = sessions.findById(sessionId)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		if (session.getRevokedAt() != null || !session.getExpiresAt().isAfter(Instant.now())) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		String renewed = tokens.sign(claims(user), session.getExpiresAt());
		session.rotate(hash(renewed), session.getExpiresAt());
		return renewed;
	}

	@Transactional
	public void revoke(String rawToken) {
		if (rawToken == null || rawToken.isBlank() || rawToken.length() > MAX_TOKEN_LENGTH) {
			return;
		}
		sessions.findActive(hash(rawToken), Instant.now()).ifPresent(session -> session.revoke(Instant.now()));
	}

	private SessionClaims claims(User user) {
		return SessionClaims.of(user, adminRegistered(user));
	}

	private boolean adminRegistered(User user) {
		return user.getUserType() == UserType.DEVELOPER && admins.existsForUser(user.getId());
	}

	private AuthenticatedUser toPrincipal(UserSession session, User user) {
		boolean adminRegistered = adminRegistered(user);
		boolean operatorAuthorized = adminRegistered
				&& session.getOtpVerifiedAt() != null
				&& session.getOtpVerifiedAt().plus(Duration.ofMinutes(PlanLimits.ADMIN_OTP_IDLE_MINUTES)).isAfter(Instant.now());
		return new AuthenticatedUser(
				user.getId(),
				user.getUsername(),
				user.getUserType(),
				user.getStatus(),
				user.getSuspendedUntil(),
				adminRegistered,
				operatorAuthorized,
				SessionClaims.onboarded(user),
				session.getId()
		);
	}

	static String hash(String raw) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256 is unavailable");
		}
	}

	private static String trim(String value, int max) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
	}

	public record IssuedSession(String rawToken, long sessionId) {
	}

	public record AuthenticatedSession(AuthenticatedUser user, String renewedToken) {
	}
}
