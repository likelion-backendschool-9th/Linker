package com.linker.backend.service.admin;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Seoul weekdays. Saturday and Sunday are skipped. Holidays are not on the calendar yet. */
public final class BusinessDays {

	private BusinessDays() {
	}

	public static Instant plus(Instant start, int days, ZoneId zone) {
		ZonedDateTime cursor = start.atZone(zone);
		int added = 0;
		while (added < days) {
			cursor = cursor.plusDays(1);
			DayOfWeek day = cursor.getDayOfWeek();
			if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY) {
				added++;
			}
		}
		return cursor.toInstant();
	}
}
