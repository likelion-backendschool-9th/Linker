package com.linker.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import com.linker.backend.dto.auth.response.GithubAuthorizeResponse;
import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.AuthProvider;
import com.linker.backend.entity.account.GithubToken;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.global.config.GithubAppProperties;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.global.security.JwtSessionTokens;
import com.linker.backend.global.security.SessionClaims;
import com.linker.backend.integration.github.GithubAccount;
import com.linker.backend.integration.github.GithubAuthorizeUrls;
import com.linker.backend.integration.github.GithubLoginState;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.integration.github.GithubUserAuthClient;
import com.linker.backend.integration.github.GithubUserSession;
import com.linker.backend.repository.account.AuthIdentityRepository;
import com.linker.backend.repository.account.GithubTokenRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.BannedGithubIdRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Paired entry for {@link com.linker.backend.controller.PublicAuthController}.
 * The httpOnly cookie is an RS256 JWT. Only its SHA-256 hash is stored.
 * Screen claims do not grant access; the session row does.
 */
@Service
public class PublicAuthService {

	private static final Duration EXTEND_WHEN_WITHIN = Duration.ofDays(1);
	private static final int MAX_TOKEN_LENGTH = 4096;

	private static final Duration WITHDRAWAL = Duration.ofDays(PlanLimits.ACCOUNT_WITHDRAWAL_RESTORE_DAYS);

	private final UserSessionRepository sessions;
	private final AdminRepository admins;
	private final JwtSessionTokens tokens;
	private final UserRepository users;
	private final AuthIdentityRepository identities;
	private final GithubTokenRepository githubTokens;
	private final BannedGithubIdRepository bannedGithubIds;
	private final GithubAppProperties github;
	private final GithubLoginState loginState;
	private final GithubUserAuthClient githubUsers;
	private final GithubTokenCipher cipher;
	private final Clock clock;
	private final TransactionTemplate transactions;

	public PublicAuthService(UserSessionRepository sessions, AdminRepository admins, JwtSessionTokens tokens,
			UserRepository users, AuthIdentityRepository identities, GithubTokenRepository githubTokens,
			BannedGithubIdRepository bannedGithubIds, GithubAppProperties github, GithubLoginState loginState,
			GithubUserAuthClient githubUsers, GithubTokenCipher cipher, Clock clock,
			PlatformTransactionManager transactionManager) {
		this.sessions = sessions;
		this.admins = admins;
		this.tokens = tokens;
		this.users = users;
		this.identities = identities;
		this.githubTokens = githubTokens;
		this.bannedGithubIds = bannedGithubIds;
		this.github = github;
		this.loginState = loginState;
		this.githubUsers = githubUsers;
		this.cipher = cipher;
		this.clock = clock;
		this.transactions = new TransactionTemplate(transactionManager);
	}

	public GithubAuthorizeResponse authorize(String client, String returnTo) {
		String normalized = normalizeClient(client);
		requireGithubLogin();
		String safeReturn = safeReturnTo(returnTo);
		String redirect = GithubAuthorizeUrls.redirectUri(github.userCallbackUrl().trim(), normalized);
		String state = loginState.issue(normalized, safeReturn, redirect);
		return new GithubAuthorizeResponse(
				GithubAuthorizeUrls.build(github.webBaseUrl(), github.clientId(), redirect, state),
				state);
	}

	public GithubLogin callback(String code, String state, String userAgent, String ip) {
		if (code == null || code.isBlank() || code.length() > 512 || code.chars().anyMatch(Character::isWhitespace)) {
			throw rejected();
		}
		requireGithubLogin();
		GithubLoginState.Pending pending = loginState.consume(state);
		GithubUserSession githubSession = githubUsers.exchange(code, pending.redirectUri());
		GithubAccount account = githubUsers.account(githubSession.accessToken());
		GithubLogin saved = transactions.execute(status -> saveLogin(account, githubSession, pending.returnTo(), userAgent, ip));
		if (saved == null) {
			throw rejected();
		}
		return saved;
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
		if (operatorIdleExpired(session, user)) {
			return Optional.empty();
		}
		return Optional.of(new AuthenticatedSession(toPrincipal(session, user), renewed));
	}

	private String rotate(String rawToken, Instant expiresAt) {
		UserSession session = active(rawToken)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		User user = session.getUser();
		if (user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null || operatorIdleExpired(session, user)) {
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

	private boolean operatorIdleExpired(UserSession session, User user) {
		if (!adminRegistered(user)) {
			return false;
		}
		return session.expireOperatorIfIdle(clock.instant(), Duration.ofMinutes(PlanLimits.ADMIN_OTP_IDLE_MINUTES));
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
		boolean operatorAuthorized = adminRegistered;
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

	private GithubLogin saveLogin(GithubAccount account, GithubUserSession githubSession, String returnTo, String userAgent, String ip) {
		String githubUserId = Long.toString(account.id());
		if (bannedGithubIds.existsByGithubUserId(githubUserId)) {
			throw new ApiException(403, "FORBIDDEN", "이용이 제한된 GitHub 계정이에요");
		}
		Instant now = clock.instant();
		Optional<AuthIdentity> found = identities.findByProviderAndProviderUserId(AuthProvider.GITHUB, githubUserId);
		User user;
		boolean isNew = found.isEmpty();
		boolean restored = false;
		if (isNew) {
			if (users.existsByUsername(account.login())) {
				throw new ApiException(409, "STATE_CONFLICT", "이미 사용 중인 사용자 이름이에요");
			}
			user = users.save(User.create(account.login(), UserType.DEVELOPER));
			user.useGithubDisplayName(account.name());
			identities.save(AuthIdentity.github(user, githubUserId, account.login(), blank(account.email()), now));
		}
		else {
			user = found.get().getUser();
			if (user.getUserType() != UserType.DEVELOPER || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null
					|| user.withdrawalExpired(now, WITHDRAWAL)) {
				throw new ApiException(403, "FORBIDDEN", "탈퇴가 완료된 계정이에요");
			}
			restored = user.restoreWithdrawal(now, WITHDRAWAL);
			if (!user.getUsername().equals(account.login())) {
				if (users.existsByUsernameAndIdNot(account.login(), user.getId())) {
					throw new ApiException(409, "STATE_CONFLICT", "이미 사용 중인 사용자 이름이에요");
				}
				user.rename(account.login());
			}
			found.get().recordLogin(account.login(), blank(account.email()), now);
		}
		user.refreshAvatar(account.avatarUrl());
		user.keepNotificationEmail(account.email(), now);
		user.touch(now);
		storeGithubToken(user, githubSession);
		return new GithubLogin(issue(user, userAgent, ip).rawToken(), isNew, restored, returnTo);
	}

	private void storeGithubToken(User user, GithubUserSession githubSession) {
		String access = cipher.encrypt(githubSession.accessToken());
		String refresh = githubSession.refreshToken() == null ? null : cipher.encrypt(githubSession.refreshToken());
		githubTokens.findByUser_Id(user.getId()).ifPresentOrElse(
				row -> row.replace(access, githubSession.accessExpiresAt(), refresh, githubSession.refreshExpiresAt()),
				() -> githubTokens.save(GithubToken.issue(user, access, githubSession.accessExpiresAt(), refresh, githubSession.refreshExpiresAt())));
	}

	private void requireGithubLogin() {
		if (github.clientId().isBlank() || github.clientSecret().isBlank()
				|| !GithubAuthorizeUrls.callbackUrl(github.userCallbackUrl())
				|| !GithubTokenCipher.usable(github.tokenEncryptionKey())) {
			throw new ApiException(503, "SERVICE_UNAVAILABLE", "GitHub 로그인 연결이 아직 준비되지 않았어요");
		}
	}

	private static String normalizeClient(String client) {
		if ("web".equals(client) || "app".equals(client)) {
			return client;
		}
		throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
	}

	static String safeReturnTo(String value) {
		if (value == null) {
			return "/feed";
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty() || !trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")
				|| trimmed.length() > 2048 || trimmed.indexOf('\\') >= 0 || trimmed.indexOf('\n') >= 0
				|| trimmed.indexOf('\r') >= 0 || trimmed.indexOf('\0') >= 0) {
			return "/feed";
		}
		return trimmed;
	}

	private static String blank(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.length() > 320 ? null : trimmed;
	}

	private static ApiException rejected() {
		return new ApiException(400, "VALIDATION_ERROR", "로그인을 완료하지 못했어요. 다시 시도해 주세요.");
	}

	public record IssuedSession(String rawToken, long sessionId) {
	}

	public record GithubLogin(String rawToken, boolean isNew, boolean restored, String returnTo) {
	}

	public record AuthenticatedSession(AuthenticatedUser user, String renewedToken) {
	}
}
