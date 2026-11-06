package com.linker.backend.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import com.linker.backend.dto.account.response.ContributionMonthResponse;
import com.linker.backend.dto.account.response.PublicProfileResponse;
import com.linker.backend.dto.account.response.PublicTeamsResponse;
import com.linker.backend.entity.account.GithubToken;
import com.linker.backend.entity.account.type.JobSeekingStatus;
import com.linker.backend.entity.account.RecruiterProfile;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.profile.ContributionDay;
import com.linker.backend.entity.profile.UserTechTag;
import com.linker.backend.entity.profile.UsernameRedirect;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.GithubContribution;
import com.linker.backend.integration.github.GithubTokenCipher;
import com.linker.backend.integration.github.GithubUserAuthClient;
import com.linker.backend.integration.github.GithubUserSession;
import com.linker.backend.repository.account.GithubTokenRepository;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.moderation.UserBlockRepository;
import com.linker.backend.repository.profile.ContributionDayRepository;
import com.linker.backend.repository.profile.FollowRepository;
import com.linker.backend.repository.profile.PublicProfileQuery;
import com.linker.backend.repository.profile.UserTechTagRepository;
import com.linker.backend.repository.profile.UsernameRedirectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Paired entry for {@link com.linker.backend.controller.AccountController}. */
@Service
public class AccountService {

	private final UserRepository users;
	private final UserTechTagRepository selectedTags;
	private final FollowRepository follows;
	private final UserBlockRepository blocks;
	private final PublicProfileQuery profileQuery;
	private final UsernameRedirectRepository redirects;
	private final RecruiterProfileRepository recruiterProfiles;
	private final ContributionDayRepository contributionDays;
	private final ProfileVisitRecorder visits;
	private final GithubTokenRepository githubTokens;
	private final GithubTokenCipher githubCipher;
	private final GithubUserAuthClient githubUsers;
	private final Clock clock;
	private final TransactionTemplate transactions;

	public AccountService(
			UserRepository users,
			UserTechTagRepository selectedTags,
			FollowRepository follows,
			UserBlockRepository blocks,
			PublicProfileQuery profileQuery,
			UsernameRedirectRepository redirects,
			RecruiterProfileRepository recruiterProfiles,
			ContributionDayRepository contributionDays,
			ProfileVisitRecorder visits,
			GithubTokenRepository githubTokens,
			GithubTokenCipher githubCipher,
			GithubUserAuthClient githubUsers,
			Clock clock,
			PlatformTransactionManager transactions) {
		this.users = users;
		this.selectedTags = selectedTags;
		this.follows = follows;
		this.blocks = blocks;
		this.profileQuery = profileQuery;
		this.redirects = redirects;
		this.recruiterProfiles = recruiterProfiles;
		this.contributionDays = contributionDays;
		this.visits = visits;
		this.githubTokens = githubTokens;
		this.githubCipher = githubCipher;
		this.githubUsers = githubUsers;
		this.clock = clock;
		this.transactions = new TransactionTemplate(transactions);
	}

	@Transactional(readOnly = true)
	public PublicProfileResponse profile(String login, AuthenticatedUser viewer) {
		Resolved resolved = resolve(login);
		User user = resolved.user();
		if (viewer != null && viewer.userId() != user.getId() && blockedEitherWay(viewer.userId(), user.getId())) {
			throw new ApiException(404, "NOT_FOUND", "볼 수 없는 프로필");
		}
		boolean self = viewer != null && viewer.userId() == user.getId();
		List<String> techStack = selectedTags.findSelected(user.getId()).stream().map(UserTechTag::tagName).toList();
		RecruiterProfile company = user.getUserType() == UserType.RECRUITER
				? recruiterProfiles.findByUser_Id(user.getId()).orElse(null)
				: null;
		PublicProfileResponse response = new PublicProfileResponse(
				user.getId(),
				user.getUsername(),
				user.visibleName(),
				user.getAvatarUrl(),
				"https://github.com/" + user.getUsername(),
				user.getUserType().name(),
				user.getUserType().name(),
				user.getBio(),
				user.getBlogUrl(),
				techStack,
				user.isLookingForTeam(),
				jobStatus(user, viewer),
				follows.countByFollowing_Id(user.getId()),
				follows.countByFollower_Id(user.getId()),
				profileQuery.completion(user.getId()),
				user.getCreatedAt(),
				self,
				viewer != null && follows.existsByFollower_IdAndFollowing_Id(viewer.userId(), user.getId()),
				false,
				resolved.redirectedFrom(),
				company == null ? null : company.getCompanyName(),
				company == null ? null : company.getJobTitle(),
				company == null ? null : company.getCompanyEmailDomain(),
				company == null ? null : company.getCompanyUrl(),
				List.of());
		if (viewer != null
				&& viewer.userType() == UserType.RECRUITER
				&& user.getUserType() == UserType.DEVELOPER
				&& viewer.userId() != user.getId()) {
			visits.recordDeveloperView(user.getId(), viewer.userId());
		}
		return response;
	}

	@Transactional(readOnly = true)
	public PublicTeamsResponse teams(String login, AuthenticatedUser viewer) {
		User user = resolve(login).user();
		if (viewer != null && viewer.userId() != user.getId() && blockedEitherWay(viewer.userId(), user.getId())) {
			throw new ApiException(404, "NOT_FOUND", "볼 수 없는 프로필");
		}
		return new PublicTeamsResponse(profileQuery.teams(user.getId()), null);
	}

	public ContributionMonthResponse contributions(String login, String month) {
		YearMonth requested = month(month);
		long userId = transactions.execute(status -> {
			User user = resolve(login).user();
			if (user.getUserType() != UserType.DEVELOPER || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
				throw new ApiException(404, "NOT_FOUND", "기여 기록을 불러오지 못했어요");
			}
			return user.getId();
		});
		refreshContributions(userId);
		return transactions.execute(status -> {
			User user = users.findById(userId).orElseThrow(this::missingGraph);
			if (user.getContributionSyncedAt() == null) {
				throw missingGraph();
			}
			LocalDate start = requested.atDay(1);
			LocalDate end = requested.atEndOfMonth();
			List<ContributionMonthResponse.Day> days = contributionDays
					.findByUser_IdAndDayBetweenOrderByDayAsc(userId, start, end)
					.stream()
					.map(row -> new ContributionMonthResponse.Day(row.getDay().toString(), row.getContributionCount()))
					.toList();
			return new ContributionMonthResponse(requested.toString(), days, user.getContributionSyncedAt());
		});
	}

	private void refreshContributions(long userId) {
		Instant startOfDay = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)).atStartOfDay(PlanLimits.APP_ZONE).toInstant();
		StoredToken stored = transactions.execute(status -> {
			User user = users.findById(userId).orElse(null);
			if (user == null || (user.getContributionSyncedAt() != null && !user.getContributionSyncedAt().isBefore(startOfDay))) {
				return null;
			}
			return githubTokens.findByUser_Id(userId)
					.map(token -> new StoredToken(
							user.getUsername(),
							token.getAccessTokenEnc(),
							token.getAccessExpiresAt(),
							token.getRefreshTokenEnc(),
							token.getRefreshExpiresAt()))
					.orElse(null);
		});
		if (stored == null) {
			return;
		}
		try {
			Instant now = clock.instant();
			String access = githubCipher.decrypt(stored.accessTokenEnc());
			GithubUserSession rotated = null;
			if (stored.accessExpiresAt() != null && !stored.accessExpiresAt().isAfter(now)) {
				if (stored.refreshTokenEnc() == null
						|| (stored.refreshExpiresAt() != null && !stored.refreshExpiresAt().isAfter(now))) {
					return;
				}
				rotated = githubUsers.refresh(githubCipher.decrypt(stored.refreshTokenEnc()));
				access = rotated.accessToken();
			}
			YearMonth current = YearMonth.now(clock.withZone(PlanLimits.APP_ZONE));
			String from = current.minusMonths(PlanLimits.CONTRIBUTION_MONTHS - 1L).atDay(1).atStartOfDay(PlanLimits.APP_ZONE).toOffsetDateTime().toString();
			String to = current.plusMonths(1).atDay(1).atStartOfDay(PlanLimits.APP_ZONE).toOffsetDateTime().toString();
			List<GithubContribution> days = githubUsers.contributions(access, stored.login(), from, to);
			GithubUserSession saved = rotated;
			transactions.executeWithoutResult(status -> {
				User user = users.findById(userId).orElseThrow(this::missingGraph);
				if (saved != null) {
					GithubToken token = githubTokens.findByUser_Id(userId).orElse(null);
					if (token != null) {
						token.replace(
								githubCipher.encrypt(saved.accessToken()),
								saved.accessExpiresAt(),
								githubCipher.encrypt(saved.refreshToken()),
								saved.refreshExpiresAt());
					}
				}
				contributionDays.deleteByUserId(userId);
				for (GithubContribution day : days) {
					contributionDays.save(ContributionDay.record(user, day.day(), day.count()));
				}
				user.markContributionSynced(now);
			});
		}
		catch (ApiException | IllegalStateException ignored) {
			// A failed refresh keeps the last stored month. Never-loaded graphs stay hidden.
		}
	}

	private YearMonth month(String raw) {
		YearMonth current = YearMonth.now(clock.withZone(PlanLimits.APP_ZONE));
		YearMonth requested;
		try {
			requested = raw == null || raw.isBlank() ? current : YearMonth.parse(raw.trim());
		}
		catch (java.time.DateTimeException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		YearMonth oldest = current.minusMonths(PlanLimits.CONTRIBUTION_MONTHS - 1L);
		if (requested.isAfter(current) || requested.isBefore(oldest)) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		return requested;
	}

	private Resolved resolve(String login) {
		if (login == null || login.isBlank()) {
			throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
		}
		String name = login.trim();
		User direct = users.findByUsername(name).filter(this::alive).orElse(null);
		if (direct != null) {
			return new Resolved(direct, null);
		}
		UsernameRedirect redirect = redirects.findByOldUsername(name).orElse(null);
		if (redirect != null && redirect.getExpiresAt().isAfter(clock.instant())) {
			User user = redirect.getUser();
			if (alive(user)) {
				return new Resolved(user, name);
			}
		}
		throw new ApiException(404, "NOT_FOUND", "사용자를 찾을 수 없어요");
	}

	private boolean alive(User user) {
		return user.getStatus() != UserStatus.DELETED && user.getDeletedAt() == null;
	}

	private boolean blockedEitherWay(long firstUserId, long secondUserId) {
		return blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(firstUserId, secondUserId)
				|| blocks.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(secondUserId, firstUserId);
	}

	private ApiException missingGraph() {
		return new ApiException(404, "NOT_FOUND", "기여 기록을 불러오지 못했어요");
	}

	static String jobStatus(User user, AuthenticatedUser viewer) {
		if (user.getJobSeekingStatus() != JobSeekingStatus.OFFERS_ONLY) {
			return user.getJobSeekingStatus() == JobSeekingStatus.OPEN ? "SEEKING" : "OFF";
		}
		boolean self = viewer != null && viewer.userId() == user.getId();
		boolean recruiter = viewer != null && viewer.userType() == UserType.RECRUITER;
		return self || recruiter ? "OPEN" : "OFF";
	}

	private record Resolved(User user, String redirectedFrom) {
	}

	private record StoredToken(
			String login,
			String accessTokenEnc,
			Instant accessExpiresAt,
			String refreshTokenEnc,
			Instant refreshExpiresAt) {
	}
}
