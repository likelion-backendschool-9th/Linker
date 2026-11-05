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
import java.util.function.Function;
import java.util.stream.Collectors;

import com.linker.backend.dto.account.request.NotificationEmailRequest;
import com.linker.backend.dto.account.request.OnboardingAgreementsRequest;
import com.linker.backend.dto.account.request.OnboardingEmailRequest;
import com.linker.backend.dto.account.request.OnboardingProfileRequest;
import com.linker.backend.dto.account.response.NotificationEmailResponse;
import com.linker.backend.dto.account.response.OnboardingResponse;
import com.linker.backend.dto.account.response.SettingsResponse;
import com.linker.backend.dto.account.response.WithdrawalCheckResponse;
import com.linker.backend.dto.account.response.WithdrawalResponse;
import com.linker.backend.entity.account.AgreementType;
import com.linker.backend.entity.account.JobSeekingStatus;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.account.UserAgreement;
import com.linker.backend.entity.profile.TechTag;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.UserAgreementRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.account.UserSessionRepository;
import com.linker.backend.repository.profile.TechTagRepository;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.service.PublicLegalService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for {@link com.linker.backend.controller.user.UserAccountController}. */
@Service
public class UserAccountService {

	/** ERD {@code users.blog_url} and {@code users.email}. Not policy numbers. */
	private static final int BLOG_URL_MAX = 2048;
	private static final int EMAIL_MAX = 320;

	private final UserRepository users;
	private final UserAgreementRepository agreements;
	private final TechTagRepository techTags;
	private final UserTechTagRepository selectedTags;
	private final PublicLegalService legal;
	private final OwnedTeamLookup ownedTeams;
	private final UserSessionRepository sessions;
	private final Clock clock;

	public UserAccountService(
			UserRepository users,
			UserAgreementRepository agreements,
			TechTagRepository techTags,
			UserTechTagRepository selectedTags,
			PublicLegalService legal,
			OwnedTeamLookup ownedTeams,
			UserSessionRepository sessions,
			Clock clock) {
		this.users = users;
		this.agreements = agreements;
		this.techTags = techTags;
		this.selectedTags = selectedTags;
		this.legal = legal;
		this.ownedTeams = ownedTeams;
		this.sessions = sessions;
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
}
