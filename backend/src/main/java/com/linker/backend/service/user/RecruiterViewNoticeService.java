package com.linker.backend.service.user;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.account.User;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.notification.NotificationRepository;
import com.linker.backend.repository.profile.ProfileVisitRepository;
import com.linker.backend.service.user.ProSubscriptionLookup.Probe;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Monday 09:00 notice for Pro developers. The count is the only content: never who or which company.
 * Free members get none. A missing {@code subscriptions} table means nobody is Pro yet.
 */
@Service("userRecruiterViewNoticeService")
public class RecruiterViewNoticeService {

	private static final Logger log = LoggerFactory.getLogger(RecruiterViewNoticeService.class);

	private final ProfileVisitRepository visits;
	private final NotificationRepository notifications;
	private final NotificationService userNotifications;
	private final UserRepository users;
	private final ProSubscriptionLookup pro;
	private final Clock clock;

	public RecruiterViewNoticeService(
			ProfileVisitRepository visits,
			NotificationRepository notifications,
			NotificationService userNotifications,
			UserRepository users,
			ProSubscriptionLookup pro,
			Clock clock
	) {
		this.visits = visits;
		this.notifications = notifications;
		this.userNotifications = userNotifications;
		this.users = users;
		this.pro = pro;
		this.clock = clock;
	}

	public void notifyPreviousWeek() {
		LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
		LocalDate weekEnd = today.with(TemporalAdjusters.previous(DayOfWeek.SUNDAY));
		LocalDate weekStart = weekEnd.minusDays(6);
		String groupKey = "recruiter-view:" + weekStart;
		Instant now = clock.instant();
		Probe probe = pro.probe();
		for (Object[] row : visits.countDistinctRecruiters(weekStart, weekEnd)) {
			long userId = ((Number) row[0]).longValue();
			int count = ((Number) row[1]).intValue();
			if (count < 1 || !pro.active(probe, userId, now) || notifications.existsByUser_IdAndGroupKey(userId, groupKey)) {
				continue;
			}
			User user = users.findById(userId).orElse(null);
			if (user == null || user.getUserType() != UserType.DEVELOPER
					|| user.getStatus() == UserStatus.DELETED || user.getDeletedAt() != null) {
				continue;
			}
			String message = "이번 주 채용 담당자 " + count + "명이 내 프로필을 봤어요.";
			try {
				userNotifications.create(new CreateNotificationCommand(
						userId,
						NotificationTypes.RECRUITER_PROFILE_VIEW,
						null,
						null,
						null,
						"/user/" + user.getUsername(),
						"{\"message\":\"" + message + "\"}",
						groupKey
				));
			}
			catch (ApiException exception) {
				log.warn("recruiter view notice skipped for user {} ({})", userId, exception.getCode());
			}
		}
	}
}
