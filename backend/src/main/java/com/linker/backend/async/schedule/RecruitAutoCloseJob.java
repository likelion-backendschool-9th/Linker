package com.linker.backend.async.schedule;

import com.linker.backend.service.user.UserRecruitmentService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * POL-R-1 / ERD daily: close OPEN recruit posts past deadline or with every role filled.
 * Separate from page-21's 14-day application expiry batch.
 */
@Component
public class RecruitAutoCloseJob {

	private static final Logger log = LoggerFactory.getLogger(RecruitAutoCloseJob.class);

	private final UserRecruitmentService recruitment;

	public RecruitAutoCloseJob(UserRecruitmentService recruitment) {
		this.recruitment = recruitment;
	}

	@Scheduled(cron = "0 5 0 * * *", zone = "Asia/Seoul")
	public void closeEligiblePosts() {
		try {
			int closed = recruitment.autoCloseEligiblePosts();
			if (closed > 0) {
				log.info("auto-closed {} recruit posts", closed);
			}
		}
		catch (RuntimeException exception) {
			log.warn("recruit auto-close failed: {}", exception.getClass().getSimpleName());
		}
	}
}
