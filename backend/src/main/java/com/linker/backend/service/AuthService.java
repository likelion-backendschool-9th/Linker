package com.linker.backend.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.linker.backend.dto.auth.request.RecruiterEmailCodeRequest;
import com.linker.backend.dto.auth.request.RecruiterEmailCodeVerifyRequest;
import com.linker.backend.dto.auth.request.RecruiterLoginRequest;
import com.linker.backend.dto.auth.request.RecruiterPasswordChangeRequest;
import com.linker.backend.dto.auth.request.RecruiterPasswordResetRequest;
import com.linker.backend.dto.auth.request.RecruiterSignupRequest;
import com.linker.backend.dto.auth.response.GithubAuthorizeResponse;
import com.linker.backend.dto.auth.response.RecruiterEmailCodeResponse;
import com.linker.backend.dto.auth.response.RecruiterEmailCodeVerifyResponse;
import com.linker.backend.dto.auth.response.RecruiterPasswordResetResponse;
import com.linker.backend.dto.auth.response.RecruiterPasswordResetStatusResponse;
import com.linker.backend.entity.account.type.AgreementType;
import com.linker.backend.entity.account.AuthIdentity;
import com.linker.backend.entity.account.type.AuthProvider;
import com.linker.backend.entity.account.EmailVerification;
import com.linker.backend.entity.account.GithubToken;
import com.linker.backend.entity.account.RecruiterProfile;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserAgreement;
import com.linker.backend.entity.account.type.VerificationPurpose;
import com.linker.backend.entity.account.UserSession;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
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
import com.linker.backend.integration.mail.MailGateway;
import com.linker.backend.repository.account.AuthIdentityRepository;
import com.linker.backend.repository.account.EmailVerificationRepository;
import com.linker.backend.repository.account.GithubTokenRepository;
import com.linker.backend.entity.profile.UsernameRedirect;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.profile.UsernameRedirectRepository;
import com.linker.backend.repository.account.UserAgreementRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.moderation.AdminRepository;
import com.linker.backend.repository.moderation.BannedGithubIdRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Paired entry for {@link com.linker.backend.controller.AuthController}.
 * The httpOnly cookie is an RS256 JWT. Only its SHA-256 hash is stored.
 * Screen claims do not grant access; the session row does.
 */
@Service
public class AuthService {

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
	private final EmailVerificationRepository verifications;
	private final RecruiterProfileRepository recruiterProfiles;
	private final UsernameRedirectRepository redirects;
	private final UserAgreementRepository agreements;
	private final PasswordEncoder passwords;
	private final MailGateway mail;
	private final Clock clock;
	private final TransactionTemplate transactions;
	private final SecureRandom random = new SecureRandom();

	public AuthService(UserSessionRepository sessions, AdminRepository admins, JwtSessionTokens tokens,
			UserRepository users, AuthIdentityRepository identities, GithubTokenRepository githubTokens,
			BannedGithubIdRepository bannedGithubIds, GithubAppProperties github, GithubLoginState loginState,
			GithubUserAuthClient githubUsers, GithubTokenCipher cipher, EmailVerificationRepository verifications,
			RecruiterProfileRepository recruiterProfiles, UserAgreementRepository agreements, PasswordEncoder passwords,
			MailGateway mail, UsernameRedirectRepository redirects, Clock clock, PlatformTransactionManager transactionManager) {
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
		this.verifications = verifications;
		this.recruiterProfiles = recruiterProfiles;
		this.redirects = redirects;
		this.agreements = agreements;
		this.passwords = passwords;
		this.mail = mail;
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
		user = currentSanctions(user);
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
		User user = currentSanctions(session.getUser());
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
	 * Marks this session as OTP-verified. HTTP verification is {@link com.linker.backend.service.admin.ModerationService#verifyOtp}.
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

	private User currentSanctions(User user) {
		User current = users.lockById(user.getId())
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		Instant now = Instant.now(clock);
		var state = users.accountSanctionState(current, now);
		current.reconcileSanctions(state.restricted(), state.until(), state.revokedCurrent(), now);
		return current;
	}

	private boolean adminRegistered(User user) {
		return user.getUserType() == UserType.DEVELOPER && admins.existsForUser(user.getId());
	}

	private AuthenticatedUser toPrincipal(UserSession session, User user) {
		boolean adminRegistered = adminRegistered(user);
		// Registration and this session's OTP are separate. The JWT adm claim stays registration-only.
		boolean operatorAuthorized = adminRegistered && session.getOtpVerifiedAt() != null;
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
				rememberPreviousLogin(user, account.login(), now);
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

	private void rememberPreviousLogin(User user, String nextLogin, Instant now) {
		String previous = user.getUsername();
		if (previous.equals(nextLogin)) {
			return;
		}
		redirects.deleteByOldUsername(nextLogin);
		Instant expiresAt = now.plus(PlanLimits.USERNAME_REDIRECT_DAYS, ChronoUnit.DAYS);
		redirects.findByOldUsername(previous).ifPresentOrElse(
				row -> row.retarget(user, expiresAt),
				() -> redirects.save(UsernameRedirect.keep(user, previous, expiresAt)));
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

	public RecruiterEmailCodeResponse requestRecruiterCode(RecruiterEmailCodeRequest request) {
		mail.requireConfigured();
		String email = companyEmail(request == null ? null : request.email());
		rejectFreeDomain(email);
		if (identities.findByProviderAndProviderUserId(AuthProvider.EMAIL, email).isPresent()) {
			throw new ApiException(409, "EMAIL_TAKEN", "이미 가입된 이메일이에요");
		}
		Instant now = clock.instant();
		IssuedCode issued = transactions.execute(status -> issueCode(email, now));
		if (issued == null) {
			throw mailUnavailable();
		}
		deliver(issued, "Linker 인증 코드",
				"Linker 인증 코드는 " + issued.code() + " 입니다.\n" + PlanLimits.RECRUITER_EMAIL_CODE_MINUTES + "분 동안 사용할 수 있어요.\n");
		return new RecruiterEmailCodeResponse(true, PlanLimits.RECRUITER_EMAIL_RESEND_SECONDS, PlanLimits.RECRUITER_EMAIL_CODE_MINUTES);
	}

	public RecruiterEmailCodeVerifyResponse verifyRecruiterCode(RecruiterEmailCodeVerifyRequest request) {
		String email = companyEmail(request == null ? null : request.email());
		String code = request == null ? null : request.code();
		Instant now = clock.instant();
		String token = transactions.execute(status -> acceptCode(email, code, now));
		if (token == null) {
			throw new ApiException(400, "CODE_MISMATCH", "인증 코드가 맞지 않아요");
		}
		return new RecruiterEmailCodeVerifyResponse(token, email.substring(email.indexOf('@') + 1));
	}

	public RecruiterAccountCreated createRecruiter(RecruiterSignupRequest request, String userAgent, String ip) {
		RecruiterAccountCreated created = transactions.execute(status -> createRecruiterAccount(request, userAgent, ip));
		if (created == null) {
			throw new ApiException(400, "TOKEN_INVALID", "이메일 인증을 다시 해 주세요");
		}
		return created;
	}

	public RecruiterAuthenticated loginRecruiter(RecruiterLoginRequest request, String userAgent, String ip) {
		RecruiterLoginAttempt attempt = transactions.execute(status -> authenticateRecruiter(request, userAgent, ip));
		if (attempt == null || attempt.failure() != null) {
			throw attempt == null ? loginFailed(null) : attempt.failure();
		}
		return attempt.authenticated();
	}

	public RecruiterPasswordResetResponse requestRecruiterPasswordReset(RecruiterPasswordResetRequest request) {
		mail.requireConfigured();
		String email = relaxedEmail(request == null ? null : request.email());
		if (email == null) {
			return new RecruiterPasswordResetResponse(true);
		}
		Instant now = clock.instant();
		IssuedCode issued = transactions.execute(status -> issueReset(email, now));
		if (issued != null) {
			deliver(issued, "Linker 비밀번호 재설정",
					"비밀번호를 다시 설정해 주세요.\n" + mail.publicBaseUrl() + "/recruiter/reset?token="
							+ URLEncoder.encode(issued.code(), StandardCharsets.UTF_8)
							+ "\n이 링크는 " + PlanLimits.RECRUITER_PASSWORD_RESET_MINUTES + "분 동안 한 번만 사용할 수 있어요.\n");
		}
		return new RecruiterPasswordResetResponse(true);
	}

	@Transactional(readOnly = true)
	public RecruiterPasswordResetStatusResponse recruiterPasswordResetStatus(String token) {
		return new RecruiterPasswordResetStatusResponse(openReset(token, clock.instant()).isPresent());
	}

	@Transactional
	public void resetRecruiterPassword(RecruiterPasswordChangeRequest request) {
		Instant now = clock.instant();
		EmailVerification row = openReset(request == null ? null : request.token(), now)
				.orElseThrow(() -> new ApiException(410, "TOKEN_EXPIRED", "링크가 만료됐어요. 다시 요청해 주세요"));
		String password = request.newPassword();
		requirePassword(password);
		AuthIdentity identity = identities.findByProviderAndProviderUserId(AuthProvider.EMAIL, row.getEmail())
				.orElseThrow(() -> new ApiException(410, "TOKEN_EXPIRED", "링크가 만료됐어요. 다시 요청해 주세요"));
		identity.changePassword(passwords.encode(password));
		row.use(now);
		sessions.revokeActive(identity.getUser().getId(), now);
	}

	private IssuedCode issueCode(String email, Instant now) {
		verifications.findFirstByEmailAndPurposeAndUsedAtIsNullOrderByIdDesc(email, VerificationPurpose.SIGNUP)
				.map(EmailVerification::getCreatedAt)
				.filter(created -> created != null && created.plusSeconds(PlanLimits.RECRUITER_EMAIL_RESEND_SECONDS).isAfter(now))
				.ifPresent(created -> {
					throw new ApiException(429, "RATE_LIMITED", "인증 코드는 1분에 한 번만 보낼 수 있어요");
				});
		verifications.invalidateUnused(email, VerificationPurpose.SIGNUP, now);
		String code = code();
		EmailVerification row = verifications.saveAndFlush(EmailVerification.issue(
				email, VerificationPurpose.SIGNUP, null, hash(code),
				now.plus(PlanLimits.RECRUITER_EMAIL_CODE_MINUTES, ChronoUnit.MINUTES)));
		return new IssuedCode(row.getId(), email, code);
	}

	private String acceptCode(String email, String code, Instant now) {
		EmailVerification row = verifications.findFirstByEmailAndPurposeAndUsedAtIsNullOrderByIdDesc(email, VerificationPurpose.SIGNUP)
				.orElseThrow(() -> new ApiException(400, "CODE_MISMATCH", "인증 코드가 맞지 않아요"));
		if (row.expired(now)) {
			throw new ApiException(400, "CODE_EXPIRED", "인증 코드가 만료됐어요");
		}
		if (code == null || !MessageDigest.isEqual(hash(code).getBytes(StandardCharsets.UTF_8), row.getCodeHash().getBytes(StandardCharsets.UTF_8))) {
			row.recordFailure();
			int remaining = Math.max(0, PlanLimits.RECRUITER_EMAIL_CODE_ATTEMPTS - row.getAttemptCount());
			if (row.getAttemptCount() >= PlanLimits.RECRUITER_EMAIL_CODE_ATTEMPTS) {
				row.use(now);
			}
			throw new ApiException(400, "CODE_MISMATCH", "인증 코드가 맞지 않아요", Map.of("remainingAttempts", remaining));
		}
		String token = token();
		row.replaceSecret(hash(token), now.plus(PlanLimits.RECRUITER_EMAIL_CODE_MINUTES, ChronoUnit.MINUTES));
		return token;
	}

	private RecruiterAccountCreated createRecruiterAccount(RecruiterSignupRequest request, String userAgent, String ip) {
		if (request == null || request.signupToken() == null || request.signupToken().isBlank()) {
			throw new ApiException(400, "TOKEN_INVALID", "이메일 인증을 다시 해 주세요");
		}
		Instant now = clock.instant();
		EmailVerification row = verifications.findFirstByPurposeAndCodeHashAndUsedAtIsNull(VerificationPurpose.SIGNUP, hash(request.signupToken()))
				.filter(found -> !found.expired(now))
				.orElseThrow(() -> new ApiException(400, "TOKEN_INVALID", "이메일 인증을 다시 해 주세요"));
		requirePassword(request.password());
		String name = bounded(request.name(), PlanLimits.PROFILE_DISPLAY_NAME_MIN, PlanLimits.PROFILE_DISPLAY_NAME_MAX, "담당자 이름을 입력해 주세요.", "이름은 " + PlanLimits.PROFILE_DISPLAY_NAME_MAX + "자 이내로 입력해 주세요.");
		String company = bounded(request.company(), PlanLimits.RECRUITER_COMPANY_MIN, PlanLimits.RECRUITER_COMPANY_MAX, "회사명을 입력해 주세요.", "회사명은 " + PlanLimits.RECRUITER_COMPANY_MAX + "자 이내로 입력해 주세요.");
		String jobTitle = bounded(request.jobTitle(), 1, PlanLimits.RECRUITER_JOB_TITLE_MAX, "직책을 입력해 주세요.", "직책은 " + PlanLimits.RECRUITER_JOB_TITLE_MAX + "자 이내로 입력해 주세요.");
		String website = optionalHttps(request.websiteUrl());
		requireConsents(request.consents());
		if (identities.findByProviderAndProviderUserId(AuthProvider.EMAIL, row.getEmail()).isPresent()) {
			throw new ApiException(409, "EMAIL_TAKEN", "이미 가입된 이메일이에요");
		}
		String pending = ("p" + UUID.randomUUID().toString().replace("-", ""));
		User user = users.saveAndFlush(User.create(pending.substring(0, Math.min(pending.length(), 39)), UserType.RECRUITER));
		String login = "r-" + user.getId();
		user.rename(login);
		user.changeDisplayName(name);
		user.keepNotificationEmail(row.getEmail(), now);
		user.completeOnboarding(now);
		user.touch(now);
		identities.save(AuthIdentity.email(user, row.getEmail(), passwords.encode(request.password()), now));
		recruiterProfiles.save(RecruiterProfile.create(user, company, row.getEmail().substring(row.getEmail().indexOf('@') + 1), jobTitle, website, now));
		accept(user, AgreementType.AGE_19, now);
		accept(user, AgreementType.TERMS, now);
		accept(user, AgreementType.BUSINESS_TERMS, now);
		accept(user, AgreementType.PRIVACY, now);
		if (Boolean.TRUE.equals(request.consents().marketingAccepted())) {
			accept(user, AgreementType.MARKETING, now);
		}
		row.use(now);
		return new RecruiterAccountCreated(issue(user, userAgent, ip).rawToken(), login);
	}

	private RecruiterLoginAttempt authenticateRecruiter(RecruiterLoginRequest request, String userAgent, String ip) {
		String email = relaxedEmail(request == null ? null : request.email());
		AuthIdentity identity = email == null ? null : identities.findByProviderAndProviderUserId(AuthProvider.EMAIL, email).orElse(null);
		if (identity == null || request == null || request.password() == null) {
			return RecruiterLoginAttempt.failed(loginFailed(null));
		}
		Instant now = clock.instant();
		if (identity.getLockedUntil() != null && identity.getLockedUntil().isAfter(now)) {
			return RecruiterLoginAttempt.failed(new ApiException(429, "LOGIN_LOCKED", "비밀번호를 5번 틀려 10분 동안 로그인할 수 없어요", Map.of("lockMinutes", PlanLimits.RECRUITER_LOGIN_LOCK_MINUTES)));
		}
		if (identity.getLockedUntil() != null) {
			identity.clearExpiredLock();
		}
		if (identity.getPasswordHash() == null || !passwords.matches(request.password(), identity.getPasswordHash())) {
			Instant lock = identity.getFailedLoginCount() + 1 >= PlanLimits.RECRUITER_LOGIN_ATTEMPTS
					? now.plus(PlanLimits.RECRUITER_LOGIN_LOCK_MINUTES, ChronoUnit.MINUTES) : null;
			identity.recordFailure(lock);
			return RecruiterLoginAttempt.failed(loginFailed(Math.max(0, PlanLimits.RECRUITER_LOGIN_ATTEMPTS - identity.getFailedLoginCount())));
		}
		User user = identity.getUser();
		if (user.getUserType() != UserType.RECRUITER || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null
				|| user.withdrawalExpired(now, WITHDRAWAL)) {
			return RecruiterLoginAttempt.failed(loginFailed(null));
		}
		boolean restored = user.restoreWithdrawal(now, WITHDRAWAL);
		identity.recordSuccess(now);
		user.touch(now);
		return RecruiterLoginAttempt.succeeded(new RecruiterAuthenticated(issue(user, userAgent, ip).rawToken(), restored, safeReturnTo(request.returnTo())));
	}

	private IssuedCode issueReset(String email, Instant now) {
		AuthIdentity identity = identities.findByProviderAndProviderUserId(AuthProvider.EMAIL, email).orElse(null);
		if (identity == null || identity.getUser().getUserType() != UserType.RECRUITER
				|| identity.getUser().getStatus() == UserStatus.DELETED || identity.getUser().getDeletedAt() != null) {
			return null;
		}
		Optional<EmailVerification> latest = verifications.findFirstByEmailAndPurposeAndUsedAtIsNullOrderByIdDesc(email, VerificationPurpose.PASSWORD_RESET);
		if (latest.isPresent() && latest.get().getCreatedAt() != null
				&& latest.get().getCreatedAt().plusSeconds(PlanLimits.RECRUITER_EMAIL_RESEND_SECONDS).isAfter(now)) {
			return null;
		}
		verifications.invalidateUnused(email, VerificationPurpose.PASSWORD_RESET, now);
		String token = token();
		EmailVerification row = verifications.saveAndFlush(EmailVerification.issue(
				email, VerificationPurpose.PASSWORD_RESET, identity.getUser().getId(), hash(token),
				now.plus(PlanLimits.RECRUITER_PASSWORD_RESET_MINUTES, ChronoUnit.MINUTES)));
		return new IssuedCode(row.getId(), email, token);
	}

	private Optional<EmailVerification> openReset(String token, Instant now) {
		if (token == null || token.isBlank() || token.length() > 256) {
			return Optional.empty();
		}
		return verifications.findFirstByPurposeAndCodeHashAndUsedAtIsNull(VerificationPurpose.PASSWORD_RESET, hash(token))
				.filter(row -> !row.expired(now));
	}

	private void deliver(IssuedCode issued, String subject, String text) {
		try {
			mail.send(issued.email(), subject, text);
		}
		catch (RuntimeException exception) {
			transactions.executeWithoutResult(status -> verifications.findById(issued.id()).ifPresent(row -> row.use(clock.instant())));
			if (exception instanceof ApiException api) {
				throw api;
			}
			throw mailUnavailable();
		}
	}

	private void accept(User user, AgreementType type, Instant now) {
		agreements.save(UserAgreement.accept(user, type, PlanLimits.TERMS_VERSION, now));
	}

	private void rejectFreeDomain(String email) {
		String domain = email.substring(email.indexOf('@') + 1);
		java.util.List<String> domains = mail.freeDomains() == null ? java.util.List.of() : mail.freeDomains();
		boolean free = domains.stream().anyMatch(item -> item != null && domain.equals(item.trim().toLowerCase(Locale.ROOT)));
		if (free) {
			throw new ApiException(400, "FREE_EMAIL_DOMAIN", "회사 메일로만 가입할 수 있어요. 개인 메일은 쓸 수 없어요.");
		}
	}

	private static void requireConsents(RecruiterSignupRequest.Consents consents) {
		if (consents == null || !Boolean.TRUE.equals(consents.ageConfirmed())) {
			throw new ApiException(400, "VALIDATION_ERROR", "만 19세 이상인지 확인해 주세요.");
		}
		if (!Boolean.TRUE.equals(consents.termsAccepted())) {
			throw new ApiException(400, "VALIDATION_ERROR", "서비스 이용약관에 동의해 주세요.");
		}
		if (!Boolean.TRUE.equals(consents.businessTermsAccepted())) {
			throw new ApiException(400, "VALIDATION_ERROR", "기업회원 추가약관에 동의해 주세요.");
		}
		if (!Boolean.TRUE.equals(consents.personalDataAccepted())) {
			throw new ApiException(400, "VALIDATION_ERROR", "기업회원 개인정보 수집·이용에 동의해 주세요.");
		}
	}

	private static void requirePassword(String password) {
		boolean letter = password != null && password.chars().anyMatch(ch -> (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z'));
		boolean digit = password != null && password.chars().anyMatch(Character::isDigit);
		if (password == null || password.length() < PlanLimits.RECRUITER_PASSWORD_MIN || password.length() > PlanLimits.RECRUITER_PASSWORD_MAX || !letter || !digit) {
			throw new ApiException(400, "PASSWORD_WEAK", "비밀번호는 8자 이상, 영문과 숫자를 포함해야 해요");
		}
	}

	private static String bounded(String raw, int min, int max, String missing, String tooLong) {
		String value = raw == null ? "" : raw.trim();
		if (value.length() < min) {
			throw new ApiException(400, "VALIDATION_ERROR", missing);
		}
		if (value.length() > max) {
			throw new ApiException(400, "VALIDATION_ERROR", tooLong);
		}
		return value;
	}

	private String optionalHttps(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim();
		try {
			java.net.URI uri = java.net.URI.create(value);
			if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && !uri.getHost().isBlank() && value.length() <= 2048) {
				return value;
			}
		}
		catch (IllegalArgumentException exception) {
			// The message below covers a malformed website.
		}
		throw new ApiException(400, "VALIDATION_ERROR", "회사 웹사이트는 https 주소로 입력해 주세요.");
	}

	private String companyEmail(String raw) {
		String email = relaxedEmail(raw);
		if (email == null) {
			throw new ApiException(400, "INVALID_EMAIL", "이메일 형식이 맞지 않아요");
		}
		return email;
	}

	private static String relaxedEmail(String raw) {
		String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
		int at = value.indexOf('@');
		if (at < 1 || at != value.lastIndexOf('@') || value.length() > 320) {
			return null;
		}
		String domain = value.substring(at + 1);
		if (domain.length() < 3 || !domain.contains(".") || domain.startsWith(".") || domain.endsWith(".") || domain.contains(" ")) {
			return null;
		}
		return value;
	}

	private String code() {
		int bound = 1;
		for (int i = 0; i < PlanLimits.RECRUITER_EMAIL_CODE_DIGITS; i++) {
			bound *= 10;
		}
		return String.format(Locale.ROOT, "%0" + PlanLimits.RECRUITER_EMAIL_CODE_DIGITS + "d", random.nextInt(bound));
	}

	private String token() {
		byte[] bytes = new byte[32];
		random.nextBytes(bytes);
		return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static ApiException loginFailed(Integer remaining) {
		return new ApiException(401, "LOGIN_FAILED", "이메일 또는 비밀번호가 맞지 않아요",
				remaining == null ? null : Map.of("remainingAttempts", remaining));
	}

	private static ApiException mailUnavailable() {
		return new ApiException(503, "SERVICE_UNAVAILABLE", "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요");
	}

	/**
	 * Failure is returned, not thrown, so the transaction that counted the attempt can commit.
	 * {@link #loginRecruiter} throws after that commit.
	 */
	private record RecruiterLoginAttempt(RecruiterAuthenticated authenticated, ApiException failure) {
		static RecruiterLoginAttempt succeeded(RecruiterAuthenticated authenticated) {
			return new RecruiterLoginAttempt(authenticated, null);
		}

		static RecruiterLoginAttempt failed(ApiException failure) {
			return new RecruiterLoginAttempt(null, failure);
		}
	}

	private record IssuedCode(long id, String email, String code) {
	}

	public record RecruiterAccountCreated(String rawToken, String login) {
	}

	public record RecruiterAuthenticated(String rawToken, boolean restored, String returnTo) {
	}

	public record IssuedSession(String rawToken, long sessionId) {
	}

	public record GithubLogin(String rawToken, boolean isNew, boolean restored, String returnTo) {
	}

	public record AuthenticatedSession(AuthenticatedUser user, String renewedToken) {
	}
}
