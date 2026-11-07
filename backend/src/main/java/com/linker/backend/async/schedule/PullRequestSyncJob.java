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
  @Scheduled(fixedDelayString = "${linker.team-setup.pr-poll-delay-ms:60000}")
  public void poll() { requests.syncDueTeams(); }
}
