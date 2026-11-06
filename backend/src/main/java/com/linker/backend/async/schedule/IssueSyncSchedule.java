package com.linker.backend.async.schedule;

import com.linker.backend.repository.issue.IssueContextRepository;
import com.linker.backend.service.user.UserIssueProgressService;
import com.linker.backend.service.user.UserIssueSyncService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "linker.issues.sync-enabled", havingValue = "true")
public class IssueSyncSchedule {
  private final UserIssueSyncService sync;
  private final com.linker.backend.service.user.UserIssueDetailService edits;
  private final UserIssueProgressService progress;
  private final IssueContextRepository contexts;

  public IssueSyncSchedule(
      UserIssueSyncService sync,
      com.linker.backend.service.user.UserIssueDetailService edits,
      UserIssueProgressService progress,
      IssueContextRepository contexts) {
    this.sync = sync;
    this.edits = edits;
    this.progress = progress;
    this.contexts = contexts;
  }

  @Scheduled(fixedDelayString = "${linker.issues.poll-delay-ms:60000}")
  public void sync() {
    edits.retryDue();
    sync.syncDueTeams();
  }

  @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
  public void snapshot() {
    if (contexts.ready()) progress.snapshot();
  }
}
