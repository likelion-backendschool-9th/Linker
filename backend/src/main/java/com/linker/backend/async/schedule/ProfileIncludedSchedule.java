package com.linker.backend.async.schedule;

import java.time.Clock;
import java.time.LocalDate;

import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.service.ProfileVisitRecorder;
import com.linker.backend.service.recruiter.RecruiterAdService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Ends job ads after the closing date and drops recruiter view rows older than 90 days. */
@Component
public class ProfileIncludedSchedule {

	private final RecruiterAdService ads;
	private final ProfileVisitRecorder visits;
	private final Clock clock;

	public ProfileIncludedSchedule(RecruiterAdService ads, ProfileVisitRecorder visits, Clock clock) {
		this.ads = ads;
		this.visits = visits;
		this.clock = clock;
	}

	@Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
	public void run() {
		ads.closePastClosingDate();
		visits.deleteOlderThan(LocalDate.now(clock.withZone(PlanLimits.APP_ZONE)).minusDays(PlanLimits.PROFILE_VISIT_RETENTION_DAYS));
	}
}
