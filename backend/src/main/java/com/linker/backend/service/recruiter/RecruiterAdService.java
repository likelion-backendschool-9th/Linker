package com.linker.backend.service.recruiter;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

import com.linker.backend.dto.ad.request.RecruiterAdRequest;
import com.linker.backend.dto.ad.request.RecruiterAdStatusRequest;
import com.linker.backend.dto.ad.response.RecruiterAdResponse;
import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.RecruiterProfile;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.UserStatus;
import com.linker.backend.entity.account.UserType;
import com.linker.backend.entity.notification.NotificationTypes;
import com.linker.backend.entity.profile.AdEndedReason;
import com.linker.backend.entity.profile.AdStatus;
import com.linker.backend.entity.profile.JobCategory;
import com.linker.backend.entity.profile.RecruiterAd;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.repository.account.RecruiterProfileRepository;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.profile.RecruiterAdRepository;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paired entry for {@link com.linker.backend.controller.recruiter.RecruiterAdController}. */
@Service
public class RecruiterAdService {

	private static final String SCOUT_REQUIRED = "Scout를 구독하면 관심 직군이 맞는 개발자의 피드에 채용 광고를 띄울 수 있어요.";
	private static final String HIDDEN = "숨겨진 광고는 다시 켤 수 없어요.";

	private final UserRepository users;
	private final RecruiterProfileRepository profiles;
	private final RecruiterAdRepository ads;
	private final RecruiterNotificationService notifications;
	private final JdbcTemplate jdbc;
	private final StringRedisTemplate redis;
	private final Clock clock;

	public RecruiterAdService(
			UserRepository users,
			RecruiterProfileRepository profiles,
			RecruiterAdRepository ads,
			RecruiterNotificationService notifications,
			JdbcTemplate jdbc,
			StringRedisTemplate redis,
			Clock clock) {
		this.users = users;
		this.profiles = profiles;
		this.ads = ads;
		this.notifications = notifications;
		this.jdbc = jdbc;
		this.redis = redis;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public RecruiterAdResponse current(AuthenticatedUser principal) {
		User recruiter = requireRecruiter(principal);
		return response(recruiter, ads.findByRecruiter_Id(recruiter.getId()).orElse(null));
	}

	@Transactional
	public RecruiterAdResponse save(AuthenticatedUser principal, RecruiterAdRequest request) {
		User recruiter = requireRecruiter(principal);
		if (!scout(recruiter.getId())) {
			throw new ApiException(403, "SCOUT_REQUIRED", SCOUT_REQUIRED);
		}
		RecruiterProfile profile = profiles.findByUser_Id(recruiter.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "회사 정보를 찾을 수 없어요"));
		Draft draft = draft(request, profile.getCompanyEmailDomain());
		RecruiterAd ad = ads.findByRecruiter_Id(recruiter.getId()).orElse(null);
		if (ad != null && ad.locked()) {
			throw new ApiException(409, "STATE_CONFLICT", HIDDEN);
		}
		countEdit(recruiter.getId());
		if (ad == null) {
			ad = ads.save(RecruiterAd.create(recruiter, draft.category(), draft.title(), draft.url(), draft.host(), draft.closesOn()));
		}
		else {
			ad.replace(draft.category(), draft.title(), draft.url(), draft.host(), draft.closesOn());
		}
		return response(recruiter, ad);
	}

	@Transactional
	public RecruiterAdResponse changeStatus(AuthenticatedUser principal, RecruiterAdStatusRequest request) {
		User recruiter = requireRecruiter(principal);
		if (request == null || request.status() == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		AdStatus next = switch (request.status()) {
			case "ACTIVE" -> AdStatus.ACTIVE;
			case "PAUSED" -> AdStatus.PAUSED;
			default -> throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		};
		RecruiterAd ad = ads.findByRecruiter_Id(recruiter.getId())
				.orElseThrow(() -> new ApiException(404, "NOT_FOUND", "채용 광고가 없어요."));
		if (ad.locked()) {
			throw new ApiException(409, "STATE_CONFLICT", HIDDEN);
		}
		if (next == AdStatus.ACTIVE) {
			if (!scout(recruiter.getId())) {
				throw new ApiException(403, "SCOUT_REQUIRED", SCOUT_REQUIRED);
			}
			if (ad.getStatus() == AdStatus.ENDED || ad.getClosesOn().isBefore(LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)))) {
				throw new ApiException(400, "VALIDATION_ERROR", "마감된 광고예요. 마감일을 바꾼 뒤에 다시 켤 수 있어요.");
			}
			ad.resume();
		}
		else {
			ad.pause();
		}
		return response(recruiter, ad);
	}

	@Transactional
	public void closePastClosingDate() {
		LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
		for (RecruiterAd ad : ads.findByStatusInAndClosesOnBefore(List.of(AdStatus.ACTIVE, AdStatus.PAUSED), today)) {
			ad.end(AdEndedReason.CLOSED);
			User recruiter = ad.getRecruiter();
			if (recruiter.getStatus() == UserStatus.DELETED || recruiter.getDeletedAt() != null) {
				continue;
			}
			notifications.create(new CreateNotificationCommand(
					recruiter.getId(),
					NotificationTypes.JOB_AD_ENDED,
					null,
					null,
					null,
					"/u/" + recruiter.getUsername(),
					"{\"message\":\"채용 광고가 마감돼 노출을 멈췄어요\"}",
					null));
		}
	}

	private RecruiterAdResponse response(User recruiter, RecruiterAd ad) {
		boolean subscribed = scout(recruiter.getId());
		if (ad == null) {
			return new RecruiterAdResponse(subscribed, null);
		}
		return new RecruiterAdResponse(subscribed, new RecruiterAdResponse.Ad(
				ad.getId(),
				ad.getStatus().name(),
				ad.getJobCategory().name(),
				ad.getTitle(),
				ad.getUrl(),
				ad.getClosesOn()));
	}

	private Draft draft(RecruiterAdRequest request, String emailDomain) {
		if (request == null) {
			throw new ApiException(400, "VALIDATION_ERROR", "요청 값을 확인해 주세요");
		}
		JobCategory category;
		try {
			category = JobCategory.valueOf(request.jobCategory() == null ? "" : request.jobCategory().trim());
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", "직군을 선택해 주세요.");
		}
		String title = request.title() == null ? "" : request.title().trim();
		if (title.length() < PlanLimits.JOB_AD_TITLE_MIN || title.length() > PlanLimits.JOB_AD_TITLE_MAX) {
			throw new ApiException(400, "VALIDATION_ERROR", "공고 제목은 2자 이상 40자 이하여야 해요.");
		}
		String url = request.url() == null ? "" : request.url().trim();
		String host = allowedHost(url, emailDomain);
		LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
		LocalDate closesOn = request.closesOn();
		if (closesOn == null || closesOn.isBefore(today) || closesOn.isAfter(today.plusDays(PlanLimits.JOB_AD_CLOSING_DAYS))) {
			throw new ApiException(400, "VALIDATION_ERROR", "마감일은 오늘부터 90일 이내여야 해요.");
		}
		return new Draft(category, title, url, host, closesOn);
	}

	private static String allowedHost(String url, String emailDomain) {
		String domain = emailDomain == null ? "" : emailDomain.toLowerCase(Locale.ROOT);
		String rejected = "회사 메일 도메인(@" + domain + ")과 같은 주소이거나 허용 채용 사이트(잡코리아·사람인·원티드·고용24)의 공고만 넣을 수 있어요.";
		URI uri;
		try {
			uri = URI.create(url);
		}
		catch (IllegalArgumentException exception) {
			throw new ApiException(400, "VALIDATION_ERROR", rejected);
		}
		String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
		if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null || host.isBlank()
				|| url.length() > 2048 || host.indexOf(':') >= 0 || host.matches("\\d{1,3}(?:\\.\\d{1,3}){3}")) {
			throw new ApiException(400, "VALIDATION_ERROR", rejected);
		}
		boolean allowed = PlanLimits.JOB_AD_ALLOWED_HOSTS.stream().anyMatch(site -> matches(host, site))
				|| (!domain.isBlank() && matches(host, domain));
		if (!allowed) {
			throw new ApiException(400, "VALIDATION_ERROR", rejected);
		}
		return host;
	}

	private static boolean matches(String host, String domain) {
		return host.equals(domain) || host.endsWith("." + domain);
	}

	private void countEdit(long userId) {
		String key = "recruiter-ad-edits:" + userId + ":" + LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
		Long count = redis.opsForValue().increment(key);
		if (count != null && count == 1L) {
			redis.expire(key, Duration.ofDays(2));
		}
		if (count != null && count > PlanLimits.JOB_AD_EDITS_PER_DAY) {
			throw new ApiException(429, "RATE_LIMITED", "채용 광고는 하루에 10번까지 수정할 수 있어요.");
		}
	}

	private boolean scout(long userId) {
		if (!ready("subscriptions", "user_id", "plan", "status", "current_period_end")) {
			return false;
		}
		Timestamp now = Timestamp.from(clock.instant());
		boolean grace = ready("subscriptions", "grace_until");
		Integer count = jdbc.queryForObject(grace ? """
				select count(*) from subscriptions
				where user_id = ? and plan = 'SCOUT' and status in ('ACTIVE', 'PAST_DUE')
				  and (current_period_end > ? or (grace_until is not null and grace_until > ?))
				""" : """
				select count(*) from subscriptions
				where user_id = ? and plan = 'SCOUT' and status in ('ACTIVE', 'PAST_DUE')
				  and current_period_end > ?
				""", Integer.class, grace ? new Object[] {userId, now, now} : new Object[] {userId, now});
		return count != null && count > 0;
	}

	private boolean ready(String table, String... columns) {
		Boolean exists = jdbc.queryForObject("select to_regclass('public." + table + "') is not null", Boolean.class);
		if (!Boolean.TRUE.equals(exists)) {
			return false;
		}
		for (String column : columns) {
			Integer count = jdbc.queryForObject("""
					select count(*) from information_schema.columns
					where table_schema = 'public' and table_name = ? and column_name = ?
					""", Integer.class, table, column);
			if (count == null || count == 0) {
				return false;
			}
		}
		return true;
	}

	private User requireRecruiter(AuthenticatedUser principal) {
		if (principal == null) {
			throw new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요");
		}
		User user = users.findById(principal.userId())
				.orElseThrow(() -> new ApiException(401, "LOGIN_REQUIRED", "로그인이 필요해요"));
		if (user.getUserType() != UserType.RECRUITER || user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
			throw new ApiException(403, "FORBIDDEN", "채용 담당자만 쓸 수 있어요");
		}
		return user;
	}

	private record Draft(JobCategory category, String title, String url, String host, LocalDate closesOn) {
	}
}
