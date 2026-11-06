package com.linker.backend.async.schedule;

import com.linker.backend.service.user.IssueProgressService;
import com.linker.backend.service.user.IssueSyncService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "linker.issues.sync-enabled", havingValue = "true")
public class IssueSyncSchedule {
  private final IssueSyncService sync;
  private final com.linker.backend.service.user.IssueReminderService reminders;
  private final com.linker.backend.service.user.IssueCreateService creation;
  private final com.linker.backend.service.user.IssueDetailService edits;
  private final IssueProgressService progress;

  public IssueSyncSchedule(
      IssueSyncService sync,
      com.linker.backend.service.user.IssueReminderService reminders,
      com.linker.backend.service.user.IssueCreateService creation,
      com.linker.backend.service.user.IssueDetailService edits,
      IssueProgressService progress) {
    this.sync = sync;
    this.reminders = reminders;
    this.creation = creation;
    this.edits = edits;
    this.progress = progress;
  }

  @Scheduled(fixedDelayString = "${linker.issues.poll-delay-ms:60000}")
  public void sync() {
    creation.retryDue();
    edits.retryDue();
    sync.syncDueTeams();
  }

  @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
  public void snapshot() {
    progress.snapshot();
  }

  @Scheduled(
      cron =
          "0 0 " + com.linker.backend.global.config.PlanLimits.ISSUE_DUE_REMINDER_HOUR + " * * *",
      zone = "Asia/Seoul")
  public void remindDueTomorrow() {
    reminders.remindDueTomorrow();
  }
}
