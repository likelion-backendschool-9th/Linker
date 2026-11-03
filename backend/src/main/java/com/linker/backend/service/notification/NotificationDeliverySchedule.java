package com.linker.backend.service.notification;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import com.linker.backend.global.config.PlanLimits;

/**
 * Quiet-hours schedule for non-chat notifications (POL-N-1).
 * Chat bypasses quiet hours. Marketing uses the tighter 9 PM–8 AM window.
 */
public final class NotificationDeliverySchedule {

	private NotificationDeliverySchedule() {
	}

	/**
	 * @return {@code null} when the notification may be delivered immediately;
	 *         otherwise the next quiet-hours end instant (usually 08:00 KST).
	 */
	public static Instant deliverAfter(String notificationType, Instant now) {
		if (NotificationTypes.CHAT.equals(notificationType)) {
			return null;
		}
		ZoneId zone = PlanLimits.APP_ZONE;
		ZonedDateTime zoned = now.atZone(zone);
		int startHour = NotificationTypes.MARKETING.equals(notificationType)
				? PlanLimits.MARKETING_QUIET_HOURS_START_HOUR
				: PlanLimits.QUIET_HOURS_START_HOUR;
		int endHour = PlanLimits.QUIET_HOURS_END_HOUR;
		LocalTime time = zoned.toLocalTime();
		LocalTime quietStart = LocalTime.of(startHour, 0);
		LocalTime quietEnd = LocalTime.of(endHour, 0);
		boolean inQuietHours = !time.isBefore(quietStart) || time.isBefore(quietEnd);
		if (!inQuietHours) {
			return null;
		}
		LocalDate deliveryDate = time.isBefore(quietEnd) ? zoned.toLocalDate() : zoned.toLocalDate().plusDays(1);
		return deliveryDate.atTime(quietEnd).atZone(zone).toInstant();
	}
}
