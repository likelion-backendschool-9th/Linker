package com.linker.backend.async.schedule;

import com.linker.backend.service.user.AiSummaryService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Page 17 AI summary (POL-C-5): fails summaries whose worker was lost to a restart or deploy, and deletes
 * results past the 7-day retention. Shared cards keep their own copy in the chat message.
 */
@Component
public class AiSummaryCleanupJob {

	private static final Logger log = LoggerFactory.getLogger(AiSummaryCleanupJob.class);

	private final AiSummaryService summaries;

	public AiSummaryCleanupJob(AiSummaryService summaries) {
		this.summaries = summaries;
	}

	@Scheduled(fixedDelayString = "${linker.ai-summary.stale-check-delay-ms:300000}",
			initialDelayString = "${linker.ai-summary.stale-check-delay-ms:300000}")
	public void failStale() {
		try {
			int failed = summaries.failStale();
			if (failed > 0) {
				log.info("failed {} stale AI summaries", failed);
			}
		}
		catch (RuntimeException exception) {
			log.warn("AI summary stale check failed: {}", exception.getClass().getSimpleName());
		}
	}

	@Scheduled(cron = "0 40 3 * * *", zone = "Asia/Seoul")
	public void deleteExpired() {
		try {
			int deleted = summaries.deleteExpired();
			if (deleted > 0) {
				log.info("deleted {} expired AI summaries", deleted);
			}
		}
		catch (RuntimeException exception) {
			log.warn("AI summary retention cleanup failed: {}", exception.getClass().getSimpleName());
		}
	}
}
