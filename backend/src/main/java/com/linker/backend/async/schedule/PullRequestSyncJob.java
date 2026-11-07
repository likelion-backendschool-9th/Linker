package com.linker.backend.async.schedule;

import com.linker.backend.service.user.GithubPullRequestService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Existing Policy cadence: active teams every 15 minutes, all teams daily. */
@Component
@ConditionalOnProperty(name = "linker.team-setup.worker-enabled", havingValue = "true")
public class PullRequestSyncJob {
  private final GithubPullRequestService requests;
  public PullRequestSyncJob(GithubPullRequestService requests) { this.requests = requests; }
  @Scheduled(fixedDelay = com.linker.backend.global.config.PlanLimits.ISSUE_ACTIVE_SYNC_MINUTES,
      timeUnit = java.util.concurrent.TimeUnit.MINUTES)
  public void active() { requests.syncActive(); }
  @Scheduled(cron = "0 0 2 * * *", zone = "Asia/Seoul")
  public void daily() { requests.syncDaily(); }
}
