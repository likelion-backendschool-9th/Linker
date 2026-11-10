package com.linker.backend.service;

import java.time.Clock;
import java.time.LocalDate;

import com.linker.backend.entity.profile.ProfileVisit;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.repository.account.UserRepository;
import com.linker.backend.repository.profile.ProfileVisitRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Writes recruiter profile views. One row per recruiter per Seoul day. */
@Service
public class ProfileVisitRecorder {

	private final ProfileVisitRepository visits;
	private final UserRepository users;
	private final Clock clock;

	public ProfileVisitRecorder(ProfileVisitRepository visits, UserRepository users, Clock clock) {
		this.visits = visits;
		this.users = users;
		this.clock = clock;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void recordDeveloperView(long profileUserId, long visitorId) {
		LocalDate today = LocalDate.now(clock.withZone(PlanLimits.APP_ZONE));
		if (visits.existsByProfileUser_IdAndVisitor_IdAndVisitDate(profileUserId, visitorId, today)) {
			return;
		}
		try {
			visits.saveAndFlush(ProfileVisit.record(
					users.getReferenceById(profileUserId),
					users.getReferenceById(visitorId),
					today));
		}
		catch (DataIntegrityViolationException ignored) {
			// A parallel view already stored today's row.
		}
	}

	@Transactional
	public void deleteOlderThan(LocalDate cutoff) {
		visits.deleteByVisitDateBefore(cutoff);
	}
}
