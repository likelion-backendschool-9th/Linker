package com.linker.backend.service.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import com.linker.backend.global.config.PlanLimits;

import org.junit.jupiter.api.Test;

class NotificationDeliveryScheduleTest {

	private static final ZoneId KST = PlanLimits.APP_ZONE;

	@Test
	void chatBypassesQuietHours() {
		Instant late = kst(2026, 11, 3, 23, 30);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.CHAT, late)).isNull();
	}

	@Test
	void nonChatDuringDayDeliversImmediately() {
		Instant afternoon = kst(2026, 11, 3, 15, 0);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.ISSUE_ASSIGNED, afternoon)).isNull();
	}

	@Test
	void nonChatAfterTenPmDefersToNextMorning() {
		Instant late = kst(2026, 11, 3, 22, 0);
		Instant expected = kst(2026, 11, 4, 8, 0);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.ISSUE_ASSIGNED, late)).isEqualTo(expected);
	}

	@Test
	void nonChatBeforeEightAmDefersToSameMorning() {
		Instant early = kst(2026, 11, 4, 2, 15);
		Instant expected = kst(2026, 11, 4, 8, 0);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.FOLLOW, early)).isEqualTo(expected);
	}

	@Test
	void marketingUsesNinePmStart() {
		Instant nine = kst(2026, 11, 3, 21, 0);
		Instant expected = kst(2026, 11, 4, 8, 0);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.MARKETING, nine)).isEqualTo(expected);
		assertThat(NotificationDeliverySchedule.deliverAfter(NotificationTypes.COMMENT, nine)).isNull();
	}

	private static Instant kst(int year, int month, int day, int hour, int minute) {
		return LocalDateTime.of(year, month, day, hour, minute).atZone(KST).toInstant();
	}
}
