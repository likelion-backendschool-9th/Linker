package com.linker.backend.async.schedule;

import com.linker.backend.service.user.RecruiterViewNoticeService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Mondays 09:00 KST: tell Pro developers how many recruiters viewed them last week. */
@Component
public class RecruiterViewNoticeSchedule {

	private final RecruiterViewNoticeService notices;

	public RecruiterViewNoticeSchedule(RecruiterViewNoticeService notices) {
		this.notices = notices;
	}

	@Scheduled(cron = "0 0 9 * * MON", zone = "Asia/Seoul")
	public void run() {
		notices.notifyPreviousWeek();
	}
}
