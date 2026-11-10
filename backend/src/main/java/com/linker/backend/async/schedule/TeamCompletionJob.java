package com.linker.backend.async.schedule;
import com.linker.backend.service.user.TeamManagementService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
@Component
public class TeamCompletionJob {
  private final TeamManagementService teams;
  public TeamCompletionJob(TeamManagementService teams) {this.teams=teams;}
  @Scheduled(cron="0 0 3 * * *",zone="Asia/Seoul")
  public void confirm() {teams.finalizeCompletions();}
}
