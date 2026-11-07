package com.linker.backend.repository.issue;

import com.linker.backend.dto.issue.request.IssueListQuery;
import com.linker.backend.dto.issue.response.IssueDetailResponse;
import com.linker.backend.dto.issue.response.IssueDetailResponse.Person;
import com.linker.backend.dto.issue.response.IssueDetailResponse.SubIssues;
import com.linker.backend.dto.issue.response.IssueFilterOptionsResponse;
import com.linker.backend.dto.issue.response.IssueListResponse;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Board;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Cached;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Context;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Reminder;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Repo;
import com.linker.backend.dto.issue.response.IssuePersistenceView.Row;
import com.linker.backend.dto.issue.response.IssueProgressResponse.Counts;
import com.linker.backend.dto.issue.response.IssueProgressResponse.Workload;
import com.linker.backend.entity.account.type.UserStatus;
import com.linker.backend.entity.account.type.UserType;
import com.linker.backend.entity.issue.Issue;
import com.linker.backend.entity.issue.IssueAssignee;
import com.linker.backend.entity.issue.IssueLabel;
import com.linker.backend.entity.issue.type.IssueState;
import com.linker.backend.entity.issue.type.IssueSyncStatus;
import com.linker.backend.entity.team.type.BoardStatus;
import com.linker.backend.entity.team.type.BoardStatusColor;
import com.linker.backend.entity.team.type.BoardStatusColors;
import com.linker.backend.global.error.ApiException;
import com.linker.backend.global.security.AuthenticatedUser;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.repository.team.TeamRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.TypedQuery;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.hibernate.ConnectionAcquisitionMode;
import org.hibernate.ConnectionReleaseMode;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Spring Data fragment. No component annotation: IssueRepository attaches it by name. Reads join
 * the issue with B's team/repo tables and A's users by plain IDs (theta joins), as in
 * TeamRepositoryImpl. Bulk updates flush and clear so later reads never see stale entities.
 */
public class IssueRepositoryImpl implements IssueRepositoryCustom {
  /** Issue rows visible to a team: live repo that is still linked to the same team. */
  private static final String VISIBLE =
      " from Issue i, GithubRepo r, TeamRepo tr"
          + " where r.id = i.repoId and tr.repoId = i.repoId and tr.teamId = i.teamId"
          + " and i.teamId = :team and i.deletedAt is null and r.deletedAt is null";

  /** Same visibility as a correlated predicate (progress counts and workloads). */
  private static final String LINKED =
      " exists (select 1 from TeamRepo vr, GithubRepo gr where gr.id = vr.repoId"
          + " and vr.teamId = i.teamId and vr.repoId = i.repoId and gr.deletedAt is null)";

  /**
   * Native on purpose: reminderEligible re-reads the candidate with FOR SHARE OF six joined tables.
   * JPA lock modes lock only the root entity's rows, so both reminder queries share this SQL to
   * keep one predicate.
   */
  private static final String REMINDER =
      "SELECT i.id,i.team_id,i.repo_id,i.number,i.title,i.due_date,u.id AS recipient,u.username"
          + " FROM issues i JOIN teams t ON t.id=i.team_id JOIN team_repos tr ON"
          + " tr.team_id=i.team_id AND tr.repo_id=i.repo_id JOIN github_repos r ON r.id=tr.repo_id"
          + " JOIN issue_assignees a ON a.issue_id=i.id JOIN users u ON u.id=a.user_id JOIN"
          + " team_members m ON m.team_id=i.team_id AND m.user_id=u.id WHERE i.team_id=:team AND"
          + " i.due_date=:due AND i.state='OPEN' AND i.board_status<>'DONE' AND i.deleted_at IS"
          + " NULL AND r.deleted_at IS NULL AND i.project_item_id IS NOT NULL AND t.status IN"
          + " ('ACTIVE','COMPLETED') AND m.left_at IS NULL AND m.github_org_state='MEMBER' AND"
          + " u.user_type='DEVELOPER' AND u.status NOT IN ('DELETED','WITHDRAWING') AND"
          + " u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM auth_identities ai WHERE"
          + " ai.user_id=u.id AND ai.provider='GITHUB' AND"
          + " ai.provider_user_id=CAST(a.github_user_id AS text))";

  private final EntityManager entityManager;
  private final EntityManagerFactory factory;
  private final TeamRepository teams;
  private final com.linker.backend.repository.subscription.SubscriptionRepository subscriptions;

  public IssueRepositoryImpl(
      EntityManager entityManager, EntityManagerFactory factory, TeamRepository teams,
      com.linker.backend.repository.subscription.SubscriptionRepository subscriptions) {
    this.entityManager = entityManager;
    this.factory = factory;
    this.teams = teams;
    this.subscriptions = subscriptions;
  }

  // ---------------------------------------------------------------- team connection

  @Override
  public Context context(long teamId) {
    var connection =
        teams
            .findConnection(teamId)
            .filter(found -> found.boardId() != null)
            .orElseThrow(() -> new ApiException(404, "NOT_FOUND", "팀 연결 정보를 찾을 수 없어요"));
    Map<String, String> statuses = new LinkedHashMap<>();
    for (var mapping : teams.findBoardStatusMappings(connection.boardId()))
      statuses.put(mapping.githubOptionId(), mapping.linkerStatus().name());
    var repos =
        teams.findLinkedRepos(teamId).stream()
            .map(r -> new Repo(r.repoId(), r.githubRepoId(), r.ownerLogin(), r.name()))
            .toList();
    return new Context(
        connection.teamId(),
        connection.installationId(),
        connection.githubOrgId(),
        connection.githubOrgLogin(),
        connection.status().name(),
        new Board(
            connection.projectNodeId(),
            connection.statusFieldId(),
            connection.startDateFieldId(),
            connection.dueDateFieldId(),
            Map.copyOf(statuses)),
        List.copyOf(repos));
  }

  @Override
  public List<Long> syncTeams() {
    return entityManager
        .createQuery(
            """
            select t.id from Team t join GithubInstallation gi on gi.id = t.installationId
            where t.status in ('ACTIVE', 'COMPLETED') and gi.removedAt is null
              and gi.suspendedAt is null
            order by t.id
            """,
            Long.class)
        .getResultList();
  }

  @Override
  public List<Long> webhookTeams(long installationId) {
    return entityManager
        .createQuery(
            """
            select t.id from Team t join GithubInstallation gi on gi.id = t.installationId
            where gi.githubInstallationId = :installation and gi.removedAt is null
              and gi.suspendedAt is null and t.status <> 'DELETED'
            order by t.id
            """,
            Long.class)
        .setParameter("installation", installationId)
        .getResultList();
  }

  @Override
  public <T> T withTeamLock(long teamId, Supplier<T> action) {
    if (TransactionSynchronizationManager.isActualTransactionActive())
      throw new IllegalStateException("Issue sync must start outside a transaction");
    // PostgreSQL session advisory locks need the SAME physical connection until unlock, so this
    // independent Hibernate session keeps its connection but opens no DB transaction (B's style).
    // Only lock/unlock failures become 503; exceptions from the action pass through unchanged.
    Session session = null;
    try {
      session =
          factory
              .unwrap(SessionFactory.class)
              .withOptions()
              .connectionHandling(
                  ConnectionAcquisitionMode.AS_NEEDED, ConnectionReleaseMode.ON_CLOSE)
              .openSession();
      String key = "linker:issue-team:" + teamId;
      boolean held;
      try {
        session.doWork(c -> c.setAutoCommit(true));
        held =
            Boolean.TRUE.equals(
                session
                    .createNativeQuery(
                        "select pg_try_advisory_lock(hashtextextended(:key,0))", Boolean.class)
                    .setParameter("key", key)
                    .getSingleResult());
      } catch (PersistenceException failure) {
        throw lockUnavailable();
      }
      if (!held) throw new ApiException(409, "STATE_CONFLICT", "이슈를 갱신 중이에요. 잠시 후 다시 시도해 주세요");
      boolean completed = false;
      try {
        T result = action.get();
        completed = true;
        return result;
      } finally {
        try {
          session
              .createNativeQuery(
                  "select pg_advisory_unlock(hashtextextended(:key,0))", Boolean.class)
              .setParameter("key", key)
              .getSingleResult();
        } catch (RuntimeException failure) {
          Session broken = session;
          try {
            broken.doWork(c -> c.abort(Runnable::run));
          } catch (RuntimeException ignored) {
            // The connection is discarded either way.
          }
          if (completed) throw lockUnavailable();
        }
      }
    } finally {
      if (session != null) {
        try {
          session.close();
        } catch (RuntimeException ignored) {
          // Closing an aborted connection must not hide the original outcome.
        }
      }
    }
  }

  private static ApiException lockUnavailable() {
    return new ApiException(503, "SERVICE_UNAVAILABLE", "이슈 갱신 연결을 확인해 주세요");
  }

  // ---------------------------------------------------------------- cache writes

  @Override
  public List<Cached> cached(long teamId) {
    return entityManager
        .createQuery(
            "select i.id, i.repoId, i.githubIssueId, i.githubNodeId, i.number, i.projectItemId"
                + " from Issue i where i.teamId = :team and i.deletedAt is null order by i.id",
            Object[].class)
        .setParameter("team", teamId)
        .getResultList()
        .stream()
        .map(
            r ->
                new Cached(
                    (Long) r[0],
                    (Long) r[1],
                    (Long) r[2],
                    (String) r[3],
                    (Integer) r[4],
                    (String) r[5]))
        .toList();
  }

  @Override
  @Transactional
  public int apply(Context expected, IssueSource.Snapshot source, boolean full, Instant now) {
    var seen = new HashSet<Long>();
    for (var part : source.repositories()) {
      if (!expected.repos().contains(part.repo())) throw conflict();
      for (var issue : part.issues()) if (!seen.add(issue.githubId())) throw conflict();
    }
    if (full
        && (source.repositories().size() != expected.repos().size()
            || !new HashSet<>(
                    source.repositories().stream().map(IssueSource.RepositoryIssues::repo).toList())
                .equals(new HashSet<>(expected.repos())))) throw conflict();
    // No archive exposure/membership policy has been frozen. Do not silently close/delete/clear
    // dates.
    if (source.projectItems().values().stream()
        .anyMatch(
            item ->
                item.archived()
                    && source.repositories().stream()
                        .flatMap(part -> part.issues().stream())
                        .anyMatch(issue -> issue.nodeId().equals(item.issueNodeId()))))
      throw new ApiException(409, "STATE_CONFLICT", "보관된 프로젝트 항목의 처리 기준을 확인해 주세요");
    if (!context(expected.teamId()).equals(expected)) throw conflict();
    // The caller's transaction may be shared; start from the database state, not loaded entities.
    entityManager.flush();
    entityManager.clear();
    int count = 0;
    for (var part : source.repositories())
      for (var issue : part.issues()) {
        var project = source.projectItems().get(issue.nodeId());
        if (project != null && !project.repoFullName().equalsIgnoreCase(part.repo().fullName()))
          throw conflict();
        save(expected, part.repo(), issue, project, now);
        count++;
      }
    if (full && !source.confirmedMissing().isEmpty()) {
      if (!Collections.disjoint(seen, source.confirmedMissing())) throw conflict();
      bulk(
          entityManager
              .createQuery(
                  "update Issue i set i.deletedAt = :now, i.updatedAt = :now where i.teamId = :team"
                      + " and i.githubIssueId in :missing and i.deletedAt is null")
              .setParameter("team", expected.teamId())
              .setParameter("missing", source.confirmedMissing())
              .setParameter("now", now));
    }
    // Outstanding GitHub writes keep their sync mark. FAILED: the latest job failed, or a job
    // still retrying recorded an error. PENDING: any other job still running.
    String latestFailed =
        "exists (select 1 from IssueSyncJob j where j.issueId = i.id and j.status = 'FAILED'"
            + " and j.id = (select max(x.id) from IssueSyncJob x where x.issueId = i.id))";
    String retryingWithError =
        "exists (select 1 from IssueSyncJob j where j.issueId = i.id"
            + " and j.status in ('PENDING', 'RUNNING') and j.lastError is not null)";
    String active =
        "exists (select 1 from IssueSyncJob j where j.issueId = i.id"
            + " and j.status in ('PENDING', 'RUNNING'))";
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.syncStatus = :status where i.teamId = :team and ("
                    + latestFailed
                    + " or "
                    + retryingWithError
                    + ")")
            .setParameter("status", IssueSyncStatus.FAILED)
            .setParameter("team", expected.teamId()));
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.syncStatus = :status where i.teamId = :team and "
                    + active
                    + " and not "
                    + latestFailed
                    + " and not "
                    + retryingWithError)
            .setParameter("status", IssueSyncStatus.PENDING)
            .setParameter("team", expected.teamId()));
    return count;
  }

  private void save(
      Context ctx, Repo repo, IssueSource.Issue source, IssueSource.ProjectItem project, Instant now) {
    var old =
        entityManager
            .createQuery("select i from Issue i where i.githubIssueId = :github", Issue.class)
            .setParameter("github", source.githubId())
            // SELECT ... FOR UPDATE: serializes writers of the same GitHub issue.
            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
            .getResultList()
            .stream()
            .findFirst();
    if (old.isPresent() && old.get().getTeamId() != ctx.teamId()) throw conflict();
    IssueState state = IssueState.valueOf(source.state());
    BoardStatus projectStatus =
        project == null ? BoardStatus.NONE : BoardStatus.valueOf(project.status());
    String item = project == null ? null : project.id();
    LocalDate start = project == null ? null : project.start();
    LocalDate due = project == null ? null : project.due();
    Issue issue;
    if (old.isPresent() && source.updated().isBefore(old.get().getGithubUpdatedAt())) {
      // Projects field reads are fresh under the same lock; Issue.updated_at is a separate clock.
      old.get().applyProjectOnly(projectStatus, item, start, due, now);
      entityManager.flush();
      return;
    }
    issue = old.orElseGet(() -> Issue.fromSource(ctx.teamId(), source.githubId()));
    issue.applySource(
        repo.id(),
        source.nodeId(),
        source.number(),
        source.title(),
        state,
        state == IssueState.CLOSED ? BoardStatus.DONE : projectStatus,
        item,
        start,
        due,
        source.authorLogin(),
        source.url(),
        source.updated(),
        source.closed(),
        now);
    if (old.isEmpty()) entityManager.persist(issue);
    entityManager.flush();
    long id = issue.getId();
    bulk(
        entityManager
            .createQuery("delete from IssueAssignee a where a.issueId = :id")
            .setParameter("id", id));
    bulk(
        entityManager
            .createQuery("delete from IssueLabel l where l.issueId = :id")
            .setParameter("id", id));
    for (var assignee : source.assignees())
      entityManager.persist(
          new IssueAssignee(id, assignee.githubId(), assignee.login(), linkedUser(assignee.githubId())));
    for (var label : source.labels())
      entityManager.persist(new IssueLabel(id, label.name(), label.color()));
    entityManager.flush();
  }

  /** The non-deleted Linker user signed in with this GitHub account, if any. */
  private Long linkedUser(long githubUserId) {
    return entityManager
        .createQuery(
            """
            select ai.user.id from AuthIdentity ai
            where ai.provider = 'GITHUB' and ai.providerUserId = :github
              and ai.user.deletedAt is null and ai.user.status <> 'DELETED'
            """,
            Long.class)
        .setParameter("github", Long.toString(githubUserId))
        .getResultList()
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Override
  @Transactional
  public void failedAdd(Context expected, long issueId, String confirmedItemId) {
    if (!context(expected.teamId()).equals(expected)) throw conflict();
    int changed =
        bulk(
            entityManager
                .createQuery(
                    "update Issue i set i.syncStatus = :status, i.projectItemId = :item"
                        + " where i.id = :id and i.teamId = :team and i.deletedAt is null")
                .setParameter("status", IssueSyncStatus.FAILED)
                .setParameter("item", confirmedItemId)
                .setParameter("id", issueId)
                .setParameter("team", expected.teamId()));
    if (changed != 1) throw conflict();
  }

  @Override
  @Transactional
  public void subIssues(long team, long parent, SubIssues children) {
    var ids =
        children.items().stream()
            .map(IssueDetailResponse.SubIssue::id)
            .filter(Objects::nonNull)
            .toList();
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.subIssuesTotal = :total, i.subIssuesDone = :done"
                    + " where i.id = :id and i.teamId = :team")
            .setParameter("id", parent)
            .setParameter("team", team)
            .setParameter("total", children.total())
            .setParameter("done", children.done()));
    if (ids.isEmpty()) {
      bulk(
          entityManager
              .createQuery(
                  "update Issue i set i.parentIssueId = null"
                      + " where i.parentIssueId = :parent and i.teamId = :team")
              .setParameter("parent", parent)
              .setParameter("team", team));
      return;
    }
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.parentIssueId = null where i.parentIssueId = :parent"
                    + " and i.teamId = :team and i.id not in :ids")
            .setParameter("parent", parent)
            .setParameter("team", team)
            .setParameter("ids", ids));
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.parentIssueId = :parent where i.id in :ids"
                    + " and i.teamId = :team and i.id <> :parent")
            .setParameter("parent", parent)
            .setParameter("team", team)
            .setParameter("ids", ids));
  }

  @Override
  @Transactional
  public void markCreatedViaLinker(long issue, long actor, boolean done) {
    bulk(
        entityManager
            .createQuery(
                "update Issue i set i.createdViaLinker = true, i.authorUserId = :actor,"
                    + " i.syncStatus = :status where i.id = :id")
            .setParameter("actor", actor)
            .setParameter("id", issue)
            .setParameter("status", done ? IssueSyncStatus.SYNCED : IssueSyncStatus.PENDING));
  }

  // ---------------------------------------------------------------- pages 11, 14, 15

  @Override
  public IssueListResponse list(
      long teamId, IssueListQuery query, boolean unscheduled, LocalDate today) {
    var params = new HashMap<String, Object>();
    params.put("team", teamId);
    String where = VISIBLE;
    if (unscheduled) where += " and (i.projectItemId is null or i.dueDate is null)";
    if (query.repo() != null) {
      where += " and i.repoId = :repo";
      params.put("repo", query.repo());
    }
    if (query.status() != null) {
      // Same as "CASE WHEN state='CLOSED' THEN 'DONE' ELSE board_status END = :status".
      if ("DONE".equals(query.status())) where += " and (i.state = 'CLOSED' or i.boardStatus = 'DONE')";
      else {
        where += " and i.state <> 'CLOSED' and i.boardStatus = :status";
        params.put("status", BoardStatus.valueOf(query.status()));
      }
    }
    where += filters(query, params);
    String scope = scope(teamId, query, unscheduled);
    Cursor after = decode(query.cursor(), scope);
    long total = bind(entityManager.createQuery("select count(i)" + where, Long.class), params)
        .getSingleResult();
    if (after != null) {
      where +=
          " and (i.githubUpdatedAt < :updated or (i.githubUpdatedAt = :updated and i.id < :id))";
      params.put("updated", after.updated());
      params.put("id", after.id());
    }
    var rows =
        listed(
            bind(
                    entityManager.createQuery(
                        "select" + CARD + where + " order by i.githubUpdatedAt desc, i.id desc",
                        Object[].class),
                    params)
                .setMaxResults(query.size() + 1)
                .getResultList());
    boolean more = rows.size() > query.size();
    var page = rows.subList(0, Math.min(rows.size(), query.size()));
    if (page.isEmpty()) return new IssueListResponse(List.of(), null, total, false, "NOT_CHECKED");
    var items = items(teamId, page, today);
    Card last = page.getLast();
    // Unknown until repository-write authorization lands; never infer it from team membership.
    return new IssueListResponse(
        items,
        more ? encode(scope, last.updated(), last.id()) : null,
        total,
        false,
        "NOT_CHECKED");
  }

  /**
   * Page 14 cards: every live issue of the team that is on the team's Projects board, with 11's
   * filters except status (the columns are the statuses). Issues off the board stay in 11's "일정
   * 없음". Ordered by due urgency: past due (oldest first), then soonest, then no due date.
   */
  @Override
  public List<IssueListResponse.Item> board(long teamId, IssueListQuery query, LocalDate today) {
    var params = new HashMap<String, Object>();
    params.put("team", teamId);
    String where = VISIBLE + " and i.projectItemId is not null";
    if (query.repo() != null) {
      where += " and i.repoId = :repo";
      params.put("repo", query.repo());
    }
    where += filters(query, params);
    var rows =
        listed(
            bind(
                    entityManager.createQuery(
                        "select" + CARD + where + " order by i.dueDate asc nulls last, i.id asc",
                        Object[].class),
                    params)
                .getResultList());
    return rows.isEmpty() ? List.of() : items(teamId, rows, today);
  }

  /** P15: overlap, not just deadlines falling inside the selected month/week. */
  @Override
  public List<IssueListResponse.Item> calendar(
      long teamId, LocalDate from, LocalDate to, String assignee, LocalDate today) {
    var params = new HashMap<String, Object>();
    params.put("team", teamId);
    params.put("from", from);
    params.put("to", to);
    String where =
        VISIBLE
            + " and i.projectItemId is not null and i.dueDate is not null"
            + " and coalesce(i.startDate, i.dueDate) <= :to and i.dueDate >= :from";
    if (assignee != null) {
      where +=
          " and exists (select 1 from IssueAssignee a where a.issueId = i.id"
              + " and a.githubLogin = :assignee)";
      params.put("assignee", assignee);
    }
    var rows =
        listed(
            bind(
                    entityManager.createQuery(
                        "select"
                            + CARD
                            + where
                            + " order by coalesce(i.startDate, i.dueDate), i.dueDate, i.id",
                        Object[].class),
                    params)
                .getResultList());
    return rows.isEmpty() ? List.of() : items(teamId, rows, today);
  }

  @Override
  public List<IssueListResponse.Item> assignedToMe(long teamId, long userId, LocalDate today) {
    var rows =
        listed(
            entityManager
                .createQuery(
                    "select"
                        + CARD
                        + VISIBLE
                        + " and i.state = 'OPEN' and exists (select 1 from IssueAssignee a"
                        + " where a.issueId = i.id and a.userId = :me)"
                        // Ascending due date already puts overdue (earlier) dates first.
                        + " order by i.dueDate asc nulls last, i.id asc",
                    Object[].class)
                .setParameter("team", teamId)
                .setParameter("me", userId)
                .getResultList());
    return rows.isEmpty() ? List.of() : items(teamId, rows, today);
  }

  /** 11/14 filters shared by list and board: open only, assignee login, label name. */
  private static String filters(IssueListQuery query, Map<String, Object> params) {
    String where = "";
    if (query.open()) where += " and i.state = 'OPEN'";
    if (query.assignee() != null) {
      where +=
          " and exists (select 1 from IssueAssignee a where a.issueId = i.id"
              + " and a.githubLogin = :assignee)";
      params.put("assignee", query.assignee());
    }
    if (query.label() != null) {
      where +=
          " and exists (select 1 from IssueLabel l where l.issueId = i.id and l.name = :label)";
      params.put("label", query.label());
    }
    return where;
  }

  /** Shared 11/14/15 card: assignees (with team membership), labels and the KST overdue mark. */
  private List<IssueListResponse.Item> items(long teamId, List<Card> page, LocalDate today) {
    List<Long> ids = page.stream().map(Card::id).toList();
    Map<BoardStatus, BoardStatusColor> statusColors = statusColors(teamId);
    Map<Long, List<IssueListResponse.Assignee>> assignees = new HashMap<>();
    for (Object[] r :
        entityManager
            .createQuery(
                """
                select a.issueId, a.userId, a.githubLogin, u.displayName, u.avatarUrl,
                  case when exists (select 1 from TeamMember m where m.teamId = :team
                    and m.userId = a.userId and m.leftAt is null) then true else false end
                from IssueAssignee a left join User u on u.id = a.userId
                where a.issueId in :ids order by a.githubLogin, a.id
                """,
                Object[].class)
            .setParameter("team", teamId)
            .setParameter("ids", ids)
            .getResultList())
      assignees
          .computeIfAbsent((Long) r[0], k -> new ArrayList<>())
          .add(assignee(r[1], r[2], r[3], r[4], r[5]));
    Map<Long, List<IssueListResponse.Label>> labels = new HashMap<>();
    for (Object[] r :
        entityManager
            .createQuery(
                "select l.issueId, l.name, l.color from IssueLabel l where l.issueId in :ids"
                    + " order by l.name",
                Object[].class)
            .setParameter("ids", ids)
            .getResultList())
      labels
          .computeIfAbsent((Long) r[0], k -> new ArrayList<>())
          .add(new IssueListResponse.Label((String) r[1], (String) r[2]));
    return page.stream()
        .map(
            row -> {
              boolean closed = row.state() == IssueState.CLOSED;
              String status = row.status().name();
              String effective = closed ? "DONE" : status;
              return new IssueListResponse.Item(
                  row.id(),
                  row.number(),
                  row.repoId(),
                  row.repoName(),
                  row.title(),
                  effective,
                  BoardStatusColors.forStatus(effective, statusColors).name(),
                  row.state().name(),
                  List.copyOf(assignees.getOrDefault(row.id(), List.of())),
                  List.copyOf(labels.getOrDefault(row.id(), List.of())),
                  row.start(),
                  row.due(),
                  !closed
                      && row.due() != null
                      && row.due().isBefore(today)
                      && !"DONE".equals(status),
                  row.itemId() != null,
                  row.sync() == IssueSyncStatus.FAILED,
                  row.sync().name(),
                  row.syncedAt());
            })
        .toList();
  }

  /** Board mapping colors for the four Linker statuses; empty when the team has no board yet. */
  public Map<BoardStatus, BoardStatusColor> statusColors(long teamId) {
    return teams
        .findConnection(teamId)
        .filter(found -> found.boardId() != null)
        .map(
            found ->
                BoardStatusColors.byLinkerStatus(teams.findBoardStatusMappings(found.boardId())))
        .orElse(Map.of());
  }

  /**
   * Card columns, repo name included from the same visibility join. Scalar projections, never
   * managed entities: callers may read again after another transaction committed (JDBC parity).
   */
  private static final String CARD =
      " i.id, i.number, i.repoId, r.name, i.title, i.boardStatus, i.state, i.startDate,"
          + " i.dueDate, i.projectItemId, i.syncStatus, i.githubUpdatedAt, i.syncedAt";

  private record Card(
      long id,
      int number,
      long repoId,
      String repoName,
      String title,
      BoardStatus status,
      IssueState state,
      LocalDate start,
      LocalDate due,
      String itemId,
      IssueSyncStatus sync,
      Instant updated,
      Instant syncedAt) {}

  private static List<Card> listed(List<Object[]> rows) {
    return rows.stream()
        .map(
            r ->
                new Card(
                    (Long) r[0],
                    (Integer) r[1],
                    (Long) r[2],
                    (String) r[3],
                    (String) r[4],
                    (BoardStatus) r[5],
                    (IssueState) r[6],
                    (LocalDate) r[7],
                    (LocalDate) r[8],
                    (String) r[9],
                    (IssueSyncStatus) r[10],
                    (Instant) r[11],
                    (Instant) r[12]))
        .toList();
  }

  private static IssueListResponse.Assignee assignee(
      Object userId, Object login, Object name, Object avatar, Object inTeam) {
    return new IssueListResponse.Assignee(
        (Long) userId,
        (String) login,
        name == null ? (String) login : (String) name,
        (String) avatar,
        Boolean.TRUE.equals(inTeam));
  }

  @Override
  public IssueFilterOptionsResponse options(long teamId) {
    var repos =
        entityManager
            .createQuery(
                """
                select r.id, r.name from TeamRepo tr, GithubRepo r
                where r.id = tr.repoId and tr.teamId = :team and r.deletedAt is null
                order by r.name, r.id
                """,
                Object[].class)
            .setParameter("team", teamId)
            .getResultList()
            .stream()
            .map(r -> new IssueFilterOptionsResponse.Repo((Long) r[0], (String) r[1]))
            .toList();
    var labels =
        entityManager
            .createQuery(
                "select distinct l.name, l.color from IssueLabel l, Issue i, GithubRepo r, TeamRepo tr"
                    + " where i.id = l.issueId and r.id = i.repoId and tr.repoId = i.repoId"
                    + " and tr.teamId = i.teamId and i.teamId = :team and i.deletedAt is null"
                    + " and r.deletedAt is null order by l.name, l.color",
                Object[].class)
            .setParameter("team", teamId)
            .getResultList()
            .stream()
            .map(r -> new IssueListResponse.Label((String) r[0], (String) r[1]))
            .toList();
    var members =
        entityManager
            .createQuery(
                """
                select distinct u.id, u.username, u.displayName, u.avatarUrl
                from TeamMember m, User u
                where u.id = m.userId and m.teamId = :team and m.leftAt is null
                  and u.deletedAt is null and u.status <> 'DELETED'
                order by u.username, u.id
                """,
                Object[].class)
            .setParameter("team", teamId)
            .getResultList()
            .stream()
            .map(
                r ->
                    new IssueFilterOptionsResponse.Member(
                        (Long) r[0],
                        (String) r[1],
                        r[2] == null ? (String) r[1] : (String) r[2],
                        (String) r[3]))
            .toList();
    return new IssueFilterOptionsResponse(
        repos, labels, members, List.of("TODO", "IN_PROGRESS", "BLOCKED", "DONE", "OTHER", "NONE"));
  }

  // ---------------------------------------------------------------- page 12 detail

  @Override
  public Row detail(long team, long id) {
    var rows =
        entityManager
            .createQuery(
                "select i.id, i.repoId, i.githubIssueId, i.githubNodeId, i.number, i.projectItemId,"
                    + " i.title, i.state, i.boardStatus, i.startDate, i.dueDate, i.authorLogin,"
                    + " i.htmlUrl, i.createdAt, i.githubUpdatedAt, i.syncStatus, i.deletedAt"
                    + " from Issue i where i.teamId = :team and i.id = :id",
                Object[].class)
            .setParameter("team", team)
            .setParameter("id", id)
            .getResultList();
    if (rows.size() != 1) throw new ApiException(404, "NOT_FOUND", "이슈를 찾을 수 없어요");
    Object[] r = rows.getFirst();
    return new Row(
        (Long) r[0],
        (Long) r[1],
        (Long) r[2],
        (String) r[3],
        (Integer) r[4],
        (String) r[5],
        (String) r[6],
        ((IssueState) r[7]).name(),
        ((BoardStatus) r[8]).name(),
        (LocalDate) r[9],
        (LocalDate) r[10],
        (String) r[11],
        (String) r[12],
        (Instant) r[13],
        (Instant) r[14],
        ((IssueSyncStatus) r[15]).name(),
        r[16] != null);
  }

  @Override
  public List<IssueListResponse.Assignee> assignees(long team, long issue) {
    return entityManager
        .createQuery(
            """
            select a.userId, a.githubLogin, u.displayName, u.avatarUrl,
              case when exists (select 1 from TeamMember m where m.teamId = :team
                and m.userId = a.userId and m.leftAt is null) then true else false end
            from IssueAssignee a left join User u on u.id = a.userId
            where a.issueId = :id order by a.githubLogin
            """,
            Object[].class)
        .setParameter("team", team)
        .setParameter("id", issue)
        .getResultList()
        .stream()
        .map(r -> assignee(r[0], r[1], r[2], r[3], r[4]))
        .toList();
  }

  @Override
  public List<IssueListResponse.Label> labels(long issue) {
    return entityManager
        .createQuery(
            "select l.name, l.color from IssueLabel l where l.issueId = :id order by l.name",
            Object[].class)
        .setParameter("id", issue)
        .getResultList()
        .stream()
        .map(r -> new IssueListResponse.Label((String) r[0], (String) r[1]))
        .toList();
  }

  @Override
  public Person author(long githubId, String login) {
    return entityManager
        .createQuery(
            """
            select u.id, u.displayName, u.avatarUrl from AuthIdentity a join a.user u
            where a.provider = 'GITHUB' and a.providerUserId = :github
              and u.deletedAt is null and u.status <> 'DELETED'
            """,
            Object[].class)
        .setParameter("github", Long.toString(githubId))
        .getResultList()
        .stream()
        .findFirst()
        .map(r -> new Person((Long) r[0], login, r[1] == null ? login : (String) r[1], (String) r[2]))
        .orElseGet(() -> new Person(null, login, login, null));
  }

  @Override
  public List<Person> assigneeCandidates(long team) {
    return entityManager
        .createQuery(
            """
            select u.id, u.username, u.displayName, u.avatarUrl
            from TeamMember m, User u, AuthIdentity a
            where u.id = m.userId and a.user.id = u.id and a.provider = 'GITHUB'
              and m.teamId = :team and m.leftAt is null and m.githubOrgState = 'MEMBER'
              and u.status = 'ACTIVE' and u.deletedAt is null
            order by u.id
            """,
            Object[].class)
        .setParameter("team", team)
        .getResultList()
        .stream()
        .map(r -> new Person((Long) r[0], (String) r[1], (String) r[2], (String) r[3]))
        .toList();
  }

  @Override
  public Long linkedId(long team, long github) {
    return entityManager
        .createQuery(
            "select i.id" + VISIBLE + " and i.githubIssueId = :github", Long.class)
        .setParameter("team", team)
        .setParameter("github", github)
        .getResultList()
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Override
  public AuthenticatedUser actor(long user) {
    Object[] r =
        entityManager
            .createQuery(
                "select u.username, u.userType, u.status from User u where u.id = :id",
                Object[].class)
            .setParameter("id", user)
            .getSingleResult();
    return new AuthenticatedUser(
        user, (String) r[0], (UserType) r[1], (UserStatus) r[2], null, false, false, false, 0);
  }

  @Override
  public List<Long> assigneeRecipients(long team, long github) {
    return entityManager
        .createQuery(
            """
            select distinct ai.user.id from AuthIdentity ai, TeamMember m, User u
            where m.userId = ai.user.id and m.teamId = :team and m.leftAt is null
              and u.id = ai.user.id and u.status = 'ACTIVE' and u.deletedAt is null
              and ai.provider = 'GITHUB' and ai.providerUserId = :github
            """,
            Long.class)
        .setParameter("team", team)
        .setParameter("github", Long.toString(github))
        .getResultList();
  }

  // ---------------------------------------------------------------- page 15 due reminders

  @Override
  @SuppressWarnings("unchecked")
  public List<Reminder> reminderCandidates(long team, LocalDate due) {
    List<Object[]> rows =
        entityManager
            .createNativeQuery(REMINDER + " ORDER BY i.id,u.id")
            .setParameter("team", team)
            .setParameter("due", due)
            .getResultList();
    return rows.stream()
        .map(
            r ->
                new Reminder(
                    ((Number) r[0]).longValue(),
                    ((Number) r[1]).longValue(),
                    ((Number) r[2]).longValue(),
                    ((Number) r[3]).intValue(),
                    (String) r[4],
                    (LocalDate) r[5],
                    ((Number) r[6]).longValue(),
                    (String) r[7]))
        .toList();
  }

  @Override
  public boolean reminderEligible(Reminder reminder) {
    // FOR SHARE OF: the issue, assignee user, membership, team and repo link must not change
    // before the notification row commits in the same transaction.
    return !entityManager
        .createNativeQuery(
            REMINDER
                + " AND i.id=:issue AND u.id=:user AND u.username=:login"
                + " FOR SHARE OF i,u,m,t,r,tr")
        .setParameter("team", reminder.team())
        .setParameter("due", reminder.due())
        .setParameter("issue", reminder.issue())
        .setParameter("user", reminder.user())
        .setParameter("login", reminder.login())
        .getResultList()
        .isEmpty();
  }

  @Override
  public boolean reminderClaimed(String key, long recipient) {
    // pg_advisory_xact_lock is PostgreSQL-only: serializes producers of the same reminder key
    // until the surrounding transaction ends.
    entityManager
        .createNativeQuery("select 1 from pg_advisory_xact_lock(hashtextextended(:key,0))")
        .setParameter("key", "linker:" + key)
        .getSingleResult();
    return entityManager
            .createQuery(
                "select count(n) from Notification n where n.user.id = :user"
                    + " and n.notificationType = 'DUE_SOON' and n.groupKey = :key",
                Long.class)
            .setParameter("user", recipient)
            .setParameter("key", key)
            .getSingleResult()
        > 0;
  }

  // ---------------------------------------------------------------- page 11 progress card

  @Override
  public boolean subscriptionsReady() {
    return subscriptions.subscriptionTableExists();
  }

  @Override
  public boolean flexActive(long teamId, Instant now) {
    return subscriptions.hasFlexBenefit(teamId, now);
  }

  @Override
  public Counts progressCounts(long teamId) {
    Object[] r =
        entityManager
            .createQuery(
                "select count(case when i.state <> 'CLOSED' and i.boardStatus = 'TODO' then 1 end),"
                    + " count(case when i.state <> 'CLOSED' and i.boardStatus = 'IN_PROGRESS' then 1 end),"
                    + " count(case when i.state <> 'CLOSED' and i.boardStatus = 'BLOCKED' then 1 end),"
                    + " count(case when i.state = 'CLOSED' or i.boardStatus = 'DONE' then 1 end)"
                    + " from Issue i where i.teamId = :team and i.deletedAt is null and"
                    + LINKED,
                Object[].class)
            .setParameter("team", teamId)
            .getSingleResult();
    return new Counts((Long) r[0], (Long) r[1], (Long) r[2], (Long) r[3]);
  }

  @Override
  public List<Workload> openWorkloads(long teamId) {
    return entityManager
        .createQuery(
            "select u.id, u.username, count(i.id) from TeamMember m join User u on u.id = m.userId"
                + " left join IssueAssignee a on a.userId = u.id"
                + " left join Issue i on i.id = a.issueId and i.teamId = :team"
                + " and i.deletedAt is null and i.state = 'OPEN' and"
                + LINKED
                + " where m.teamId = :team and m.leftAt is null and u.deletedAt is null"
                + " and u.status <> 'DELETED' group by u.id, u.username order by u.username, u.id",
            Object[].class)
        .setParameter("team", teamId)
        .getResultList()
        .stream()
        .map(r -> new Workload((Long) r[0], (String) r[1], (Long) r[2]))
        .toList();
  }

  @Override
  public long overdueCount(long teamId, LocalDate today) {
    return entityManager
        .createQuery(
            "select count(i) from Issue i where i.teamId = :team and i.deletedAt is null and"
                + LINKED
                + " and i.state = 'OPEN' and i.boardStatus <> 'DONE' and i.dueDate < :today",
            Long.class)
        .setParameter("team", teamId)
        .setParameter("today", today)
        .getSingleResult();
  }

  @Override
  public long dueSoonCount(long teamId, LocalDate today, LocalDate soon) {
    return entityManager
        .createQuery(
            "select count(i) from Issue i where i.teamId = :team and i.deletedAt is null and"
                + LINKED
                + " and i.state = 'OPEN' and i.boardStatus <> 'DONE'"
                + " and i.dueDate between :today and :soon",
            Long.class)
        .setParameter("team", teamId)
        .setParameter("today", today)
        .setParameter("soon", soon)
        .getSingleResult();
  }

  // ---------------------------------------------------------------- helpers

  private int bulk(jakarta.persistence.Query query) {
    entityManager.flush();
    int changed = query.executeUpdate();
    entityManager.clear();
    return changed;
  }

  private static <T> TypedQuery<T> bind(TypedQuery<T> query, Map<String, Object> params) {
    params.forEach(query::setParameter);
    return query;
  }

  private static ApiException conflict() {
    return new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요. 다시 확인해 주세요");
  }

  private record Cursor(Instant updated, long id) {}

  private static String scopeField(String value) {
    return value == null
        ? "-"
        : Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(value.getBytes(StandardCharsets.UTF_8));
  }

  private static String scope(long teamId, IssueListQuery q, boolean unscheduled) {
    String raw =
        teamId
            + "|"
            + unscheduled
            + "|"
            + q.repo()
            + "|"
            + q.status()
            + "|"
            + scopeField(q.assignee())
            + "|"
            + scopeField(q.label())
            + "|"
            + q.open();
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static String encode(String scope, Instant updated, long id) {
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString((scope + "|" + updated + "|" + id).getBytes(StandardCharsets.UTF_8));
  }

  private static Cursor decode(String encoded, String scope) {
    if (encoded == null) return null;
    try {
      String[] parts =
          new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8)
              .split("\\|", -1);
      if (parts.length != 3 || !scope.equals(parts[0])) throw IssueListQuery.invalid();
      long id = Long.parseLong(parts[2]);
      if (id <= 0) throw IssueListQuery.invalid();
      return new Cursor(Instant.parse(parts[1]), id);
    } catch (IllegalArgumentException | java.time.format.DateTimeParseException e) {
      throw IssueListQuery.invalid();
    }
  }
}
