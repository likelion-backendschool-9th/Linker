package com.linker.backend.service.user;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.linker.backend.dto.account.request.NotificationEmailRequest;
import com.linker.backend.dto.account.request.OnboardingAgreementsRequest;
import com.linker.backend.dto.account.request.OnboardingEmailRequest;
import com.linker.backend.dto.account.request.OnboardingProfileRequest;
import com.linker.backend.dto.account.request.ProfileUpdateRequest;
import com.linker.backend.dto.account.response.GithubProfileSyncResponse;
import com.linker.backend.dto.account.response.NotificationEmailResponse;
import com.linker.backend.dto.account.response.OnboardingResponse;
import com.linker.backend.dto.account.response.ProfileEditResponse;
import com.linker.backend.dto.account.response.ProfilePeopleResponse;
import com.linker.backend.dto.account.response.SettingsResponse;
import com.linker.backend.dto.account.response.WithdrawalCheckResponse;
import com.linker.backend.dto.account.response.WithdrawalResponse;
import com.linker.backend.entity.account.AgreementType;
import com.linker.backend.entity.account.GithubToken;
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.account.UserAgreement;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.entity.profile.Follow;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.entity.profile.JobCategory;
import com.linker.backend.entity.profile.UserJobCategory;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubAccount;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.integration.github.GithubUserAuthClient;
import com.linker.backend.integration.github.GithubUserSession;
import com.linker.backend.repository.account.GithubTokenRepository;
import com.linker.backend.repository.account.UserAgreementRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.profile.UserJobCategoryRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.service.PublicLegalService;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Paired entry for {@link com.linker.backend.controller.user.UserAccountController}. */
@Service
public class UserAccountService {

	/** ERD {@code users.blog_url} and {@code users.email}. Not policy numbers. */
	private static final int BLOG_URL_MAX = 2048;
	private static final int EMAIL_MAX = 320;
	/** Follower sheet page size. Not a policy number. */
	private static final int PEOPLE_PAGE_SIZE = 20;

	private final UserRepository users;
	private final UserAgreementRepository agreements;
	private final TechTagRepository techTags;
	private final UserTechTagRepository selectedTags;
	private final UserJobCategoryRepository jobCategories;
	private final PublicLegalService legal;
	private final OwnedTeamLookup ownedTeams;
	private final UserSessionRepository sessions;
	private final FollowRepository follows;
	private final UserNotificationService notifications;
	private final GithubTokenRepository githubTokens;
	private final GithubTokenCipher githubCipher;
	private final GithubUserAuthClient githubUsers;
	private final PlatformTransactionManager transactions;
	private final Clock clock;

	public UserAccountService(
			UserRepository users,
			UserAgreementRepository agreements,
			TechTagRepository techTags,
			UserTechTagRepository selectedTags,
			UserJobCategoryRepository jobCategories,
			PublicLegalService legal,
			OwnedTeamLookup ownedTeams,
			UserSessionRepository sessions,
			FollowRepository follows,
			UserNotificationService notifications,
			GithubTokenRepository githubTokens,
			GithubTokenCipher githubCipher,
			GithubUserAuthClient githubUsers,
			PlatformTransactionManager transactions,
			Clock clock) {
		this.users = users;
		this.agreements = agreements;
		this.techTags = techTags;
		this.selectedTags = selectedTags;
		this.jobCategories = jobCategories;
		this.legal = legal;
		this.ownedTeams = ownedTeams;
		this.sessions = sessions;
		this.follows = follows;
		this.notifications = notifications;
		this.githubTokens = githubTokens;
		this.githubCipher = githubCipher;
		this.githubUsers = githubUsers;
		this.transactions = transactions;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public OnboardingResponse onboarding(AuthenticatedUser principal) {
		User user = requireUser(principal);
		boolean done = user.isOnboarded();
		boolean agreed = requiredAgreements(user.getId());
		String step = !agreed ? "AGREEMENTS" : emailRequired(user) && !done ? "EMAIL" : "PROFILE";
		List<String> stack = selectedTags.findSelected(user.getId()).stream().map(UserTechTag::tagName).toList();
		return new OnboardingResponse(
				done,
				step,
				new OnboardingResponse.Defaults(
						user.visibleName(),
						blank(user.getBio()),
						blank(user.getBlogUrl()),
						stack,
						user.isLookingForTeam(),
						jobStatus(user.getJobSeekingStatus())),
				emailRequired(user),
				legal.termsVersion());
	}

	@Transactional
	public void acceptAgreements(AuthenticatedUser principal, OnboardingAgreementsRequest request) {
		String version = legal.termsVersion();
		if (request.termsVersion() == null || !version.equals(request.termsVersion())) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		if (!request.ageConfirmed()) {
			throw new ApiException(400, "VALIDATION_ERROR", "만 14세 이상인지 확인해 주세요.");
		}
		if (!request.termsAccepted()) {
			throw new ApiException(400, "VALIDATION_ERROR", "이용약관에 동의해 주세요.");
		}
		if (!request.privacyAccepted()) {
			throw new ApiException(400, "VALIDATION_ERROR", "개인정보 처리방침에 동의해 주세요.");
		}
		User user = requireUser(principal);
		Instant now = Instant.now(clock);
		record(user, AgreementType.AGE_14, true, version, now);
		record(user, AgreementType.TERMS, true, version, now);
		record(user, AgreementType.PRIVACY, true, version, now);
		record(user, AgreementType.MARKETING, request.marketingAccepted(), version, now);
	}

	@Transactional
	public void saveProfile(AuthenticatedUser principal, OnboardingProfileRequest request) {
		String name = displayName(request.name());
		String bio = bio(request.bio());
		String blogUrl = blogUrl(request.blogUrl());
		List<String> names = techNames(request.techStack());
		JobSeekingStatus jobStatus = jobSeeking(request.jobStatus());
		User user = requireUser(principal);
		requireAgreements(user.getId());
		Instant now = Instant.now(clock);
		user.applyOnboardingProfile(name, bio, blogUrl, request.lookingForTeam(), jobStatus, now);
		replaceTechStack(user, names);
		user.completeOnboarding(now);
	}

	/**
	 * Included. Stores a notification email only when GitHub did not provide one.
	 * Mail delivery is not decided yet, so this does not send a verification code.
	 */
	@Transactional
	public void saveEmail(AuthenticatedUser principal, OnboardingEmailRequest request) {
		User user = requireUser(principal);
		if (!emailRequired(user)) {
			return;
		}
		user.keepNotificationEmail(notificationEmail(request.email()));
	}

	@Transactional(readOnly = true)
	public SettingsResponse settings(AuthenticatedUser principal) {
		User user = requireUser(principal);
		String email = user.getEmail();
		return new SettingsResponse(
				github(user),
				email == null ? "" : email,
				user.isPushEnabled(),
				freePlan());
	}

	/** Stores the notification address. Sending mail waits for a mail provider. */
	@Transactional
	public NotificationEmailResponse changeEmail(AuthenticatedUser principal, NotificationEmailRequest request) {
		User user = requireUser(principal);
		user.changeNotificationEmail(notificationEmail(request.email()));
		return new NotificationEmailResponse(user.getEmail());
	}

	@Transactional(readOnly = true)
	public WithdrawalCheckResponse withdrawalCheck(AuthenticatedUser principal) {
		requireUser(principal);
		return new WithdrawalCheckResponse(ownedTeamResponses(principal.userId()));
	}

	@Transactional
	public WithdrawalResponse withdraw(AuthenticatedUser principal) {
		User user = requireUser(principal);
		if (user.getStatus() == UserStatus.DELETED) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		List<WithdrawalCheckResponse.OwnedTeamResponse> owned = ownedTeamResponses(user.getId());
		if (!owned.isEmpty()) {
			throw new ApiException(409, "OWNED_TEAMS_EXIST", "오너인 팀을 먼저 넘기거나 삭제해 주세요");
		}
		Instant now = Instant.now(clock);
		if (user.getStatus() != UserStatus.WITHDRAWING) {
			user.markWithdrawing(now);
		}
		sessions.revokeActive(user.getId(), now);
		Instant requestedAt = user.getWithdrawRequestedAt() == null ? now : user.getWithdrawRequestedAt();
		return new WithdrawalResponse(deletesOn(requestedAt));
	}

	/**
	 * Pending withdrawal older than {@link PlanLimits#ACCOUNT_WITHDRAWAL_DAYS}.
	 * Posts and comments are deleted from this same batch once those tables exist.
	 */
	@Transactional
	public void anonymizeExpiredWithdrawals(Instant now) {
		Instant deadline = now.minus(PlanLimits.ACCOUNT_WITHDRAWAL_DAYS, ChronoUnit.DAYS);
		for (User user : users.findByStatusAndWithdrawRequestedAtLessThanEqual(UserStatus.WITHDRAWING, deadline)) {
			user.anonymize(now);
			sessions.revokeActive(user.getId(), now);
		}
	}

	private List<WithdrawalCheckResponse.OwnedTeamResponse> ownedTeamResponses(long userId) {
		return ownedTeams.ownedBy(userId).stream()
				.map(team -> new WithdrawalCheckResponse.OwnedTeamResponse(team.id(), team.name()))
				.toList();
	}

	private static String deletesOn(Instant requestedAt) {
		return LocalDate.ofInstant(requestedAt, PlanLimits.APP_ZONE)
				.plusDays(PlanLimits.ACCOUNT_WITHDRAWAL_DAYS)
				.toString();
	}

	private static SettingsResponse.Github github(User user) {
		if (user.getUserType() != UserType.DEVELOPER) {
			return null;
		}
		return new SettingsResponse.Github(user.getUsername(), true);
	}

	/** Subscription rows do not exist yet. Checkout fills the paid summary later. */
	private static SettingsResponse.Plan freePlan() {
		return new SettingsResponse.Plan("FREE", "무료", "FREE");
	}

	private User requireUser(AuthenticatedUser principal) {
		return users.findById(principal.userId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
	}

	private void requireAgreements(Long userId) {
		if (!agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(
				userId, AgreementType.AGE_14, legal.termsVersion())) {
			throw new ApiException(400, "VALIDATION_ERROR", "만 14세 이상인지 확인해 주세요.");
		}
		if (!agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(
				userId, AgreementType.TERMS, legal.termsVersion())) {
			throw new ApiException(400, "VALIDATION_ERROR", "이용약관에 동의해 주세요.");
		}
		if (!agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(
				userId, AgreementType.PRIVACY, legal.termsVersion())) {
			throw new ApiException(400, "VALIDATION_ERROR", "개인정보 처리방침에 동의해 주세요.");
		}
	}

	private boolean requiredAgreements(Long userId) {
		String version = legal.termsVersion();
		return agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(userId, AgreementType.AGE_14, version)
				&& agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(userId, AgreementType.TERMS, version)
				&& agreements.existsByUser_IdAndAgreementTypeAndVersionAndWithdrawnAtIsNull(userId, AgreementType.PRIVACY, version);
	}

	private static boolean emailRequired(User user) {
		String email = user.getEmail();
		return email == null || email.isBlank();
	}

	private void record(User user, AgreementType type, boolean accepted, String version, Instant now) {
		var found = agreements.findByUser_IdAndAgreementTypeAndVersion(user.getId(), type, version);
		if (!accepted) {
			found.filter(UserAgreement::isActive).ifPresent(row -> row.withdraw(now));
			return;
		}
		found.ifPresentOrElse(row -> row.acceptAgain(now), () -> agreements.save(UserAgreement.accept(user, type, version, now)));
	}

	private void replaceTechStack(User user, List<String> names) {
		Map<String, TechTag> byName = names.isEmpty()
				? Map.of()
				: techTags.findByNameIn(names).stream()
						.collect(Collectors.toMap(TechTag::getName, Function.identity(), (left, right) -> left));
		List<TechTag> ordered = new ArrayList<>();
		for (String name : names) {
			TechTag tag = byName.get(name);
			if (tag == null) {
				throw new ApiException(400, "VALIDATION_ERROR", "기술 스택을 다시 선택해 주세요.");
			}
			ordered.add(tag);
		}
		selectedTags.deleteByUserId(user.getId());
		for (TechTag tag : ordered) {
			selectedTags.save(UserTechTag.link(user, tag));
		}
	}

	private static String displayName(String raw) {
		String name = raw == null ? "" : raw.trim();
		if (name.length() < PlanLimits.PROFILE_DISPLAY_NAME_MIN) {
			throw new ApiException(400, "VALIDATION_ERROR", "이름을 입력해 주세요.");
		}
		if (name.length() > PlanLimits.PROFILE_DISPLAY_NAME_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "이름은 " + PlanLimits.PROFILE_DISPLAY_NAME_MAX + "자 이내로 입력해 주세요.");
		}
		return name;
	}

	private static String bio(String raw) {
		String value = raw == null ? "" : raw;
		if (value.length() > PlanLimits.PROFILE_BIO_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "소개는 " + PlanLimits.PROFILE_BIO_MAX + "자 이내로 입력해 주세요.");
		}
		return value;
	}

	private StoredGithubToken loadGithubToken(AuthenticatedUser principal) {
		User user = requireDeveloper(principal);
		GithubToken token = githubTokens.findByUser_Id(user.getId()).orElseThrow(this::loginAgain);
		return new StoredGithubToken(
				token.getAccessTokenEnc(),
				token.getAccessExpiresAt(),
				token.getRefreshTokenEnc(),
				token.getRefreshExpiresAt());
	}

	private User requireDeveloper(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		User user = requireUser(principal);
		if (user.getUserType() != UserType.DEVELOPER) {
			throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
		}
		return user;
	}

	private static String githubBio(String raw) {
		String value = raw == null ? "" : raw.trim();
		if (value.length() > PlanLimits.PROFILE_BIO_MAX) {
			value = value.substring(0, PlanLimits.PROFILE_BIO_MAX);
		}
		return value;
	}

	private static String githubBlog(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim();
		if (value.length() > BLOG_URL_MAX || !httpsUrl(value)) {
			return null;
		}
		return value;
	}

	private ApiException loginAgain() {
		return new ApiException(401, "LOGIN_REQUIRED", "GitHub에 다시 로그인해 주세요");
	}

	private record StoredGithubToken(
			String accessTokenEnc,
			Instant accessExpiresAt,
			String refreshTokenEnc,
			Instant refreshExpiresAt) {
	}

	private static String blogUrl(String raw) {
		if (raw == null || raw.isBlank()) {
			return null;
		}
		String value = raw.trim();
		if (value.length() > BLOG_URL_MAX || !httpsUrl(value)) {
			throw new ApiException(400, "VALIDATION_ERROR", "블로그 주소는 https로 시작해야 해요.");
		}
		return value;
	}

	private static boolean httpsUrl(String value) {
		try {
			URI uri = URI.create(value);
			return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && !uri.getHost().isBlank();
		}
		catch (IllegalArgumentException exception) {
			return false;
		}
	}

	private static List<String> techNames(List<String> raw) {
		if (raw == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		LinkedHashSet<String> names = new LinkedHashSet<>();
		for (String item : raw) {
			if (item == null || item.isBlank()) {
				throw new ApiException(400, "VALIDATION_ERROR", "기술 스택을 다시 선택해 주세요.");
			}
			names.add(item.trim());
		}
		if (names.size() > PlanLimits.PROFILE_TECH_STACK_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "기술 스택은 " + PlanLimits.PROFILE_TECH_STACK_MAX + "개까지 선택할 수 있어요.");
		}
		return List.copyOf(names);
	}

	private static JobSeekingStatus jobSeeking(String status) {
		if (status == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		return switch (status) {
			case "SEEKING" -> JobSeekingStatus.OPEN;
			case "OPEN" -> JobSeekingStatus.OFFERS_ONLY;
			case "OFF" -> JobSeekingStatus.OFF;
			default -> throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		};
	}

	private static String notificationEmail(String raw) {
		String email = raw == null ? "" : raw.trim();
		if (email.isEmpty()) {
			throw new ApiException(400, "VALIDATION_ERROR", "이메일을 입력해 주세요.");
		}
		if (email.length() > EMAIL_MAX || email.indexOf('@') < 1 || email.indexOf('@') != email.lastIndexOf('@')
				|| email.contains(" ") || !email.substring(email.indexOf('@') + 1).contains(".")) {
			throw new ApiException(400, "VALIDATION_ERROR", "이메일 주소를 확인해 주세요.");
		}
		return email;
	}

	static String jobStatus(JobSeekingStatus status) {
		return switch (status) {
			case OPEN -> "SEEKING";
			case OFFERS_ONLY -> "OPEN";
			case OFF -> "OFF";
		};
	}

	private static String blank(String value) {
		return value == null ? "" : value;
	}

	@Transactional(readOnly = true)
	public ProfileEditResponse profile(AuthenticatedUser principal) {
		return profileOf(requireUser(principal));
	}

	@Transactional
	public ProfileEditResponse updateProfile(AuthenticatedUser principal, ProfileUpdateRequest request) {
		User user = requireUser(principal);
		if (user.getUserType() != UserType.DEVELOPER) {
			throw new ApiException(403, "DEVELOPER_ONLY", "개발자만 사용할 수 있어요");
		}
		if (request == null || request.lookingForTeam() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		user.applyOnboardingProfile(
				displayName(request.name()),
				bio(request.bio()),
				blogUrl(request.blogUrl()),
				request.lookingForTeam(),
				jobSeeking(request.jobStatus()),
				Instant.now(clock));
		replaceTechStack(user, techNames(request.techStack()));
		replaceJobCategories(user, request.jobCategories());
		return profileOf(user);
	}

	/**
	 * Reloads name, bio, blog, and avatar from the stored GitHub user token.
	 * GitHub HTTP stays outside the write transaction. Tech stack and job status stay.
	 */
	public GithubProfileSyncResponse syncFromGithub(AuthenticatedUser principal) {
		StoredGithubToken stored = new TransactionTemplate(transactions).execute(status -> loadGithubToken(principal));
		if (stored == null) {
			throw loginAgain();
		}
		Instant now = Instant.now(clock);
		String access = githubCipher.decrypt(stored.accessTokenEnc());
		GithubUserSession rotated = null;
		if (stored.accessExpiresAt() != null && !stored.accessExpiresAt().isAfter(now)) {
			if (stored.refreshTokenEnc() == null
					|| (stored.refreshExpiresAt() != null && !stored.refreshExpiresAt().isAfter(now))) {
				throw loginAgain();
			}
			rotated = githubUsers.refresh(githubCipher.decrypt(stored.refreshTokenEnc()));
			access = rotated.accessToken();
		}
		GithubAccount account = githubUsers.account(access);
		GithubUserSession saved = rotated;
		return new TransactionTemplate(transactions).execute(status -> {
			User user = requireDeveloper(principal);
			user.refreshFromGithub(account.name(), githubBio(account.bio()), githubBlog(account.blog()), account.avatarUrl());
			if (saved != null) {
				GithubToken token = githubTokens.findByUser_Id(user.getId()).orElseThrow(this::loginAgain);
				token.replace(
						githubCipher.encrypt(saved.accessToken()),
						saved.accessExpiresAt(),
						githubCipher.encrypt(saved.refreshToken()),
						saved.refreshExpiresAt());
			}
			return GithubProfileSyncResponse.from(profileOf(user), now);
		});
	}

	@Transactional
	public void settleInactiveProfiles(Instant now) {
		Instant teamDeadline = now.minus(PlanLimits.PROFILE_LOOKING_FOR_TEAM_IDLE_DAYS, ChronoUnit.DAYS);
		Instant jobDeadline = now.minus(PlanLimits.PROFILE_JOB_SEEKING_IDLE_DAYS, ChronoUnit.DAYS);
		for (User user : users.findInactiveDevelopers(teamDeadline)) {
			Instant active = user.getLastActiveAt() != null ? user.getLastActiveAt() : user.getCreatedAt();
			if (active == null) {
				continue;
			}
			if (user.isLookingForTeam() && !active.isAfter(teamDeadline)) {
				user.clearLookingForTeam();
			}
			if (user.getJobSeekingStatus() != JobSeekingStatus.OFF && !active.isAfter(jobDeadline)) {
				user.markJobSeekingOffForInactivity(now);
			}
		}
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void deliverJobSeekingOffNotice(long userId) {
		User user = users.findById(userId).orElse(null);
		if (user == null || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			return;
		}
		if (!user.takeJobSeekingOffNotice()) {
			return;
		}
		notifications.create(new CreateNotificationCommand(
				user.getId(),
				NotificationTypes.JOB_SEEKING_OFF,
				null,
				null,
				null,
				"/settings/profile",
				"{\"message\":\"구직 상태를 껐어요\"}",
				null));
	}

	private void replaceJobCategories(User user, List<String> raw) {
		if (raw == null) {
			return;
		}
		LinkedHashSet<JobCategory> picked = new LinkedHashSet<>();
		for (String item : raw) {
			if (item == null || item.isBlank()) {
				throw new ApiException(400, "VALIDATION_ERROR", "관심 직군을 다시 선택해 주세요.");
			}
			try {
				picked.add(JobCategory.valueOf(item.trim()));
			}
			catch (IllegalArgumentException exception) {
				throw new ApiException(400, "VALIDATION_ERROR", "관심 직군을 다시 선택해 주세요.");
			}
		}
		if (picked.size() > PlanLimits.JOB_CATEGORIES_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "관심 직군은 " + PlanLimits.JOB_CATEGORIES_MAX + "개까지 선택할 수 있어요.");
		}
		jobCategories.deleteByUserId(user.getId());
		for (JobCategory category : picked) {
			jobCategories.save(UserJobCategory.pick(user, category));
		}
	}

	private ProfileEditResponse profileOf(User user) {
		List<String> techStack = selectedTags.findSelected(user.getId()).stream().map(UserTechTag::tagName).toList();
		List<String> categories = jobCategories.findByUser_IdOrderByIdAsc(user.getId()).stream().map(UserJobCategory::key).toList();
		return new ProfileEditResponse(
				"DEVELOPER",
				user.visibleName(),
				blank(user.getBio()),
				blank(user.getBlogUrl()),
				techStack,
				user.isLookingForTeam(),
				jobStatus(user.getJobSeekingStatus()),
				categories);
	}

	@Transactional(readOnly = true)
	public ProfilePeopleResponse followers(AuthenticatedUser viewer, String login, String cursor) {
		return people(viewer, visible(login).getId(), cursor, true);
	}

	@Transactional(readOnly = true)
	public ProfilePeopleResponse followings(AuthenticatedUser viewer, String login, String cursor) {
		return people(viewer, visible(login).getId(), cursor, false);
	}

	@Transactional
	public void follow(AuthenticatedUser viewer, String login) {
		User follower = requireActive(viewer.userId());
		User target = visible(login);
		if (follower.getId().equals(target.getId())) {
			throw new ApiException(400, "VALIDATION_ERROR", "자기 자신은 팔로우할 수 없어요");
		}
		if (target.getUserType() != UserType.DEVELOPER) {
			throw new ApiException(403, "FORBIDDEN", "채용 담당자는 팔로우할 수 없어요");
		}
		if (follows.existsByFollower_IdAndFollowing_Id(follower.getId(), target.getId())) {
			return;
		}
		Instant start = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE))
				.atStartOfDay(PlanLimits.APP_ZONE)
				.toInstant();
		if (follows.countByFollower_IdAndCreatedAtGreaterThanEqual(follower.getId(), start) >= PlanLimits.FOLLOWS_PER_DAY) {
			throw new ApiException(429, "RATE_LIMITED", "팔로우는 하루에 " + PlanLimits.FOLLOWS_PER_DAY + "명까지 할 수 있어요");
		}
		follows.save(Follow.link(follower, target));
		notifications.create(new CreateNotificationCommand(
				target.getId(),
				NotificationTypes.FOLLOW,
				follower.getId(),
				"USER",
				follower.getId(),
				"/u/" + follower.getUsername(),
				null,
				null));
	}

	@Transactional
	public void unfollow(AuthenticatedUser viewer, String login) {
		User follower = requireActive(viewer.userId());
		User target = visible(login);
		follows.deletePair(follower.getId(), target.getId());
	}

	private ProfilePeopleResponse people(AuthenticatedUser viewer, long userId, String cursor, boolean followers) {
		Long before = cursor(cursor);
		var page = PageRequest.of(0, PEOPLE_PAGE_SIZE + 1);
		List<Follow> rows = followers
				? (before == null ? follows.followersFirst(userId, page) : follows.followersBefore(userId, before, page))
				: (before == null ? follows.followingsFirst(userId, page) : follows.followingsBefore(userId, before, page));
		String nextCursor = null;
		if (rows.size() > PEOPLE_PAGE_SIZE) {
			rows = rows.subList(0, PEOPLE_PAGE_SIZE);
			nextCursor = Long.toString(rows.get(PEOPLE_PAGE_SIZE - 1).getId());
		}
		List<Long> ids = rows.stream().map(row -> person(row, followers).getId()).toList();
		Set<Long> followed = ids.isEmpty()
				? Set.of()
				: Set.copyOf(follows.findFollowedIds(viewer.userId(), ids));
		List<ProfilePeopleResponse.Person> items = rows.stream()
				.map(row -> {
					User person = person(row, followers);
					return new ProfilePeopleResponse.Person(
							new ProfilePeopleResponse.Card(
									person.getId(),
									person.getUsername(),
									person.visibleName(),
									person.getAvatarUrl(),
									person.getUserType().name(),
									visibleJobStatus(person, viewer)),
							followed.contains(person.getId()));
				})
				.toList();
		return new ProfilePeopleResponse(items, nextCursor);
	}

	private static User person(Follow follow, boolean followers) {
		return followers ? follow.getFollower() : follow.getFollowing();
	}

	private User requireActive(long userId) {
		return users.findById(userId)
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
	}

	private User visible(String login) {
		if (login == null || login.isBlank()) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		return users.findByUsername(login.trim())
				.filter(user -> user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null)
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요"));
	}

	private static String visibleJobStatus(User user, AuthenticatedUser viewer) {
		if (user.getJobSeekingStatus() != JobSeekingStatus.OFFERS_ONLY) {
			return jobStatus(user.getJobSeekingStatus());
		}
		boolean self = viewer.userId() == user.getId();
		boolean recruiter = viewer.userType() == UserType.RECRUITER;
		return self || recruiter ? "OPEN" : "OFF";
	}

	private static Long cursor(String cursor) {
		if (cursor == null || cursor.isBlank()) {
			return null;
		}
		try {
			return Long.valueOf(cursor);
		} catch (NumberFormatException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
	}
}
