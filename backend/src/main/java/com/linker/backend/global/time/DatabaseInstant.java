package com.linker.backend.global.time;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * PostgreSQL {@code timestamptz} stores microseconds.
 * Block periods and chat text share this truncation so {@code [created_at, unblocked_at)} compares one clock.
 */
public final class DatabaseInstant {

	private DatabaseInstant() {
	}

	public static Instant now(Clock clock) {
		return clock.instant().truncatedTo(ChronoUnit.MICROS);
	}
}
