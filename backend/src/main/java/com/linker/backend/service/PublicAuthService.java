package com.linker.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.moderation.AdminRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paired entry for {@link com.linker.backend.controller.PublicAuthController}.
 * Also owns cookie-session issue/authenticate for the security filter and later login flows.
 */
@Service
public class PublicAuthService {

	private static final Duration EXTEND_WHEN_WITHIN = Duration.ofDays(1);
	private static final int MAX_TOKEN_LENGTH = 256;

	private final UserSessionRepository sessions;
	private final AdminRepository admins;
	private final SecureRandom random = new SecureRandom();

	public PublicAuthService(UserSessionRepository sessions, AdminRepository admins) {
		this.sessions = sessions;
		this.admins = admins;
	}

	public void refresh(String rawToken) {
		extendNow(rawToken);
	}

	@Transactional
	public IssuedSession issue(User user, String userAgent, String ip) {
		String raw = newToken();
		Instant expiresAt = Instant.now().plus(Duration.ofDays(PlanLimits.SESSION_DAYS));
		UserSession session = sessions.save(UserSession.issue(user, hash(raw), trim(userAgent, 512), trim(ip, 64), expiresAt));
		return new IssuedSession(raw, session.getId());
	}

	@Transactional
	public Optional<AuthenticatedSession> authenticate(String rawToken, boolean slideExpiry) {
		if (rawToken == null || rawToken.isBlank() || rawToken.length() > MAX_TOKEN_LENGTH) {
			return Optional.empty();
		}
		Optional<UserSession> found = sessions.findActive(hash(rawToken), Instant.now());
		if (found.isEmpty()) {
			return Optional.empty();
		}
		UserSession session = found.get();
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			return Optional.empty();
		}
		boolean rewritten = false;
		if (slideExpiry) {
			Instant target = Instant.now().plus(Duration.ofDays(PlanLimits.SESSION_DAYS));
			if (session.getExpiresAt().isBefore(target.minus(EXTEND_WHEN_WITHIN))) {
				session.extendTo(target);
				user.touch(Instant.now());
				rewritten = true;
			}
		}
		return Optional.of(new AuthenticatedSession(toPrincipal(session, user), rewritten));
	}

	@Transactional
	public void extendNow(String rawToken) {
		if (rawToken == null || rawToken.isBlank() || rawToken.length() > MAX_TOKEN_LENGTH) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		UserSession session = sessions.findActive(hash(rawToken), Instant.now())
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		Instant now = Instant.now();
		session.extendTo(now.plus(Duration.ofDays(PlanLimits.SESSION_DAYS)));
		user.touch(now);
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

	@Transactional
	public void revoke(String rawToken) {
		if (rawToken == null || rawToken.isBlank() || rawToken.length() > MAX_TOKEN_LENGTH) {
			return;
		}
		sessions.findActive(hash(rawToken), Instant.now()).ifPresent(session -> session.revoke(Instant.now()));
	}

	private AuthenticatedUser toPrincipal(UserSession session, User user) {
		boolean adminRegistered = user.getUserType() == UserType.DEVELOPER && admins.existsForUser(user.getId());
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
				session.getId()
		);
	}

	private String newToken() {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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

	public record AuthenticatedSession(AuthenticatedUser user, boolean cookieRewritten) {
	}
}
