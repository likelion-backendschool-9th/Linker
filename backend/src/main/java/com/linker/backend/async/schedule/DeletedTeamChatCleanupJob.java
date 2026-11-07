package com.linker.backend.async.schedule;

import com.linker.backend.service.user.TeamManagementService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Policy ch. 6: remove chat only once the team's 30-day deletion deadline has passed. */
@Component
public class DeletedTeamChatCleanupJob {
  private final TeamManagementService teams;

  public DeletedTeamChatCleanupJob(TeamManagementService teams) {
    this.teams = teams;
  }

  @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
  public void cleanup() {
    teams.purgeDeletedChats();
  }
}
