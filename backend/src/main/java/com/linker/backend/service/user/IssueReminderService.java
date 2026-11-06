package com.linker.backend.service.user;

import com.linker.backend.dto.notification.request.CreateNotificationCommand;
import com.linker.backend.entity.notification.type.NotificationTypes;
import com.linker.backend.global.config.PlanLimits;
import com.linker.backend.integration.github.GithubAppClient;
import com.linker.backend.integration.github.GithubIssueClient;
import com.linker.backend.repository.issue.*;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/** Produces in-app notifications through D's contract; never sends push or STOMP directly. */
@Service("userIssueReminderService")
@Transactional(propagation = Propagation.NEVER)
public class IssueReminderService {
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(IssueReminderService.class);
  private final IssueContextRepository contexts;
  private final IssueReminderRepository reminders;
  private final IssueDetailRepository actors;
  private final UserIssueAccess access;
  private final IssueSyncLock locks;
  private final GithubIssueClient github;
  private final GithubAppClient app;
  private final NotificationService notifications;
  private final Clock clock;
  private final TransactionTemplate tx;
  private final JsonMapper json = JsonMapper.builder().build();

  public IssueReminderService(
      IssueContextRepository contexts,
      IssueReminderRepository reminders,
      IssueDetailRepository actors,
      UserIssueAccess access,
      IssueSyncLock locks,
      GithubIssueClient github,
      GithubAppClient app,
      NotificationService notifications,
      Clock clock,
      PlatformTransactionManager manager) {
    this.contexts = contexts;
    this.reminders = reminders;
    this.actors = actors;
    this.access = access;
    this.locks = locks;
    this.github = github;
    this.app = app;
    this.notifications = notifications;
    this.clock = clock;
    this.tx = new TransactionTemplate(manager);
  }

  public int remindDueTomorrow() {
    var now = clock.instant().atZone(PlanLimits.APP_ZONE);
    if (now.getHour() != PlanLimits.ISSUE_DUE_REMINDER_HOUR || !contexts.ready()) return 0;
    LocalDate due = now.toLocalDate().plusDays(PlanLimits.ISSUE_DUE_REMINDER_DAYS_BEFORE);
    int produced = 0;
    for (long team : contexts.syncTeams())
      try {
        produced += locks.team(team, () -> remind(team, due));
      } catch (RuntimeException e) {
        log.warn("Issue due reminder skipped for team {} ({})", team, e.getClass().getSimpleName());
      }
    return produced;
  }

  private int remind(long team, LocalDate due) {
    var context = contexts.get(team);
    int produced = 0;
    for (var candidate : reminders.candidates(team, due))
      try {
        var actor = actors.actor(candidate.user());
        access.member(actor, team);
        var repo =
            context.repos().stream()
                .filter(r -> r.id() == candidate.repo())
                .findFirst()
                .orElse(null);
        if (repo == null
            || !github.candidateCanRead(
                repo, candidate.login(), app.installationReadToken(context.installationId())))
          continue;
        String key =
            "issue-due:" + team + ":" + candidate.issue() + ":" + due + ":" + candidate.user();
        boolean created =
            tx.execute(
                st -> {
                  if (reminders.claimed(key, candidate.user())) return false;
                  access.member(actors.actor(candidate.user()), team);
                  if (!contexts.get(team).equals(context) || !reminders.eligible(candidate))
                    return false;
                  String path = "/teams/" + team + "/issues/" + candidate.issue();
                  String payload =
                      json.writeValueAsString(
                          Map.of(
                              "title",
                              "내일 마감인 이슈가 있어요",
                              "body",
                              repo.fullName()
                                  + " #"
                                  + candidate.number()
                                  + " · "
                                  + candidate.title(),
                              "teamId",
                              team,
                              "issueId",
                              candidate.issue(),
                              "dueDate",
                              due.toString()));
                  notifications.create(
                      new CreateNotificationCommand(
                          candidate.user(),
                          NotificationTypes.DUE_SOON,
                          null,
                          "ISSUE",
                          candidate.issue(),
                          path,
                          payload,
                          key));
                  return true;
                });
        if (created) produced++;
      } catch (RuntimeException e) {
        log.warn(
            "Issue due reminder skipped for issue {} / recipient {} ({})",
            candidate.issue(),
            candidate.user(),
            e.getClass().getSimpleName());
      }
    return produced;
  }
}
