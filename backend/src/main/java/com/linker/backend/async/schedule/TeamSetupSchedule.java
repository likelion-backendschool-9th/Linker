package com.linker.backend.async.schedule;

import com.linker.backend.service.user.UserTeamSyncService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "linker.team-setup.worker-enabled", havingValue = "true")
public class TeamSetupSchedule {
  private final UserTeamSyncService sync;

  public TeamSetupSchedule(UserTeamSyncService sync) {
    this.sync = sync;
  }

  @Scheduled(fixedDelayString = "${linker.team-setup.poll-delay-ms:5000}")
  public void drain() {
    sync.drain();
  }

  @Scheduled(cron = "0 0 0 * * *", zone = "Asia/Seoul")
  public void archive() {
    sync.archiveReadOnly();
  }
}
