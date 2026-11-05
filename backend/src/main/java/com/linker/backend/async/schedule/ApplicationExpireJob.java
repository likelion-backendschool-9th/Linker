package com.linker.backend.async.schedule;

import com.linker.backend.service.user.UserRecruitmentService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * POL-R-4: expire PENDING applications after 14 days and notify applicants.
 * Separate from recruit-post auto-close ({@link RecruitAutoCloseJob}).
 */
@Component
public class ApplicationExpireJob {

	private static final Logger log = LoggerFactory.getLogger(ApplicationExpireJob.class);

	private final UserRecruitmentService recruitment;

	public ApplicationExpireJob(UserRecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@Scheduled(cron = "0 15 0 * * *", zone = "Asia/Seoul")
	public void expireOverdue() {
		try {
			int expired = recruitment.expireOverdueApplications();
			if (expired > 0) {
				log.info("expired {} pending applications", expired);
			}
		}
		catch (RuntimeException exception) {
			log.warn("application expiry failed: {}", exception.getClass().getSimpleName());
		}
	}
}
