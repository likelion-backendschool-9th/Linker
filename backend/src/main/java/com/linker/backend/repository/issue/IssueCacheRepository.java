package com.linker.backend.repository.issue;

import com.linker.backend.global.error.ApiException;
import com.linker.backend.integration.github.IssueSource;
import com.linker.backend.repository.issue.IssueContextRepository.Context;
import com.linker.backend.repository.issue.IssueContextRepository.Repo;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class IssueCacheRepository {
  private final NamedParameterJdbcTemplate jdbc;
  private final IssueContextRepository contexts;
  private final TransactionTemplate transaction;

  public IssueCacheRepository(
      NamedParameterJdbcTemplate jdbc,
      IssueContextRepository contexts,
      PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.contexts = contexts;
    this.transaction = new TransactionTemplate(manager);
  }

  public record Cached(
      long id, long repoId, long githubId, String nodeId, int number, String itemId) {}

  public List<Cached> cached(long teamId) {
    return jdbc.query(
        "SELECT id,repo_id,github_issue_id,github_node_id,number,project_item_id FROM issues"
            + " WHERE team_id=:team AND deleted_at IS NULL ORDER BY id",
        Map.of("team", teamId),
        (rs, n) ->
            new Cached(
                rs.getLong(1),
                rs.getLong(2),
                rs.getLong(3),
                rs.getString(4),
                rs.getInt(5),
                rs.getString(6)));
  }

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
        .anyMatch(item ->
            item.archived()
                && source.repositories().stream()
                    .flatMap(part -> part.issues().stream())
                    .anyMatch(issue -> issue.nodeId().equals(item.issueNodeId()))))
      throw new ApiException(409, "STATE_CONFLICT", "보관된 프로젝트 항목의 처리 기준을 확인해 주세요");
    return transaction.execute(status -> {
      if (!contexts.get(expected.teamId()).equals(expected)) throw conflict();
      var localIds = new ArrayList<Long>();
      int count = 0;
      for (var part : source.repositories())
        for (var issue : part.issues()) {
          var project = source.projectItems().get(issue.nodeId());
          if (project != null && !project.repoFullName().equalsIgnoreCase(part.repo().fullName()))
            throw conflict();
          localIds.add(save(expected, part.repo(), issue, project, now));
          count++;
        }
      if (full && !source.confirmedMissing().isEmpty()) {
        if (!java.util.Collections.disjoint(seen, source.confirmedMissing())) throw conflict();
        jdbc.update(
            "UPDATE issues SET deleted_at=:now,updated_at=:now WHERE team_id=:team AND"
                + " github_issue_id IN (:missing) AND deleted_at IS NULL",
            new MapSqlParameterSource("team", expected.teamId())
                .addValue("missing", source.confirmedMissing())
                .addValue("now", Timestamp.from(now)));
      }
      return count;
    });
  }

  private long save(
      Context ctx,
      Repo repo,
      IssueSource.Issue issue,
      IssueSource.ProjectItem project,
      Instant now) {
    var key = Map.of("github", issue.githubId());
    var old =
        jdbc.query(
            "SELECT id,team_id,github_updated_at FROM issues WHERE github_issue_id=:github FOR"
                + " UPDATE",
            key,
            (rs, n) -> new Object[] {rs.getLong(1), rs.getLong(2), rs.getTimestamp(3).toInstant()});
    if (!old.isEmpty() && (long) old.getFirst()[1] != ctx.teamId()) throw conflict();
    String board =
        "CLOSED".equals(issue.state()) ? "DONE" : project == null ? "NONE" : project.status();
    var p =
        new MapSqlParameterSource("team", ctx.teamId())
            .addValue("repo", repo.id())
            .addValue("github", issue.githubId())
            .addValue("node", issue.nodeId())
            .addValue("number", issue.number())
            .addValue("title", issue.title())
            .addValue("state", issue.state())
            .addValue("author", issue.authorLogin())
            .addValue("url", issue.url())
            .addValue("updated", Timestamp.from(issue.updated()))
            .addValue("closed", issue.closed() == null ? null : Timestamp.from(issue.closed()))
            .addValue("item", project == null ? null : project.id())
            .addValue("board", board)
            .addValue("start", project == null ? null : project.start())
            .addValue("due", project == null ? null : project.due())
            .addValue("now", Timestamp.from(now));
    long id;
    boolean older = !old.isEmpty() && issue.updated().isBefore((Instant) old.getFirst()[2]);
    if (old.isEmpty()) {
      id =
          jdbc.queryForObject(
              "INSERT INTO"
                  + " issues(team_id,repo_id,github_issue_id,github_node_id,number,title,state,"
                  + "board_status,project_item_id,start_date,due_date,author_login,html_url,github_updated_at,closed_at,synced_at)"
                  + " VALUES(:team,:repo,:github,:node,:number,:title,:state,:board,:item,:start,:due,:author,:url,:updated,:closed,:now)"
                  + " RETURNING id",
              p,
              Long.class);
    } else {
      id = (long) old.getFirst()[0];
      p.addValue("id", id);
      if (older) {
        p.addValue("board", project == null ? "NONE" : project.status());
        // Projects field reads are fresh under the same lock; Issue.updated_at is a separate clock.
        jdbc.update(
            "UPDATE issues SET board_status=CASE WHEN state='CLOSED' THEN 'DONE' ELSE :board"
                + " END,project_item_id=:item,start_date=:start,due_date=:due,sync_status='SYNCED',synced_at=:now,updated_at=:now"
                + " WHERE id=:id",
            p);
        return id;
      }
      jdbc.update(
          "UPDATE issues SET"
              + " repo_id=:repo,github_node_id=:node,number=:number,title=:title,state=:state,"
              + "board_status=:board,project_item_id=:item,start_date=:start,due_date=:due,author_login=:author,html_url=:url,github_updated_at=:updated,closed_at=:closed,deleted_at=NULL,sync_status='SYNCED',synced_at=:now,updated_at=:now"
              + " WHERE id=:id",
          p);
    }
    p.addValue("id", id);
    jdbc.update("DELETE FROM issue_assignees WHERE issue_id=:id", p);
    for (var a : issue.assignees()) {
      var ap =
          new MapSqlParameterSource("issue", id)
              .addValue("github", a.githubId())
              .addValue("login", a.login());
      jdbc.update(
          "INSERT INTO issue_assignees(issue_id,github_user_id,github_login,user_id)"
              + " VALUES(:issue,:github,:login,(SELECT ai.user_id FROM auth_identities ai JOIN"
              + " users u ON u.id=ai.user_id WHERE ai.provider='GITHUB' AND"
              + " ai.provider_user_id=CAST(:github AS text) AND u.deleted_at IS NULL AND u.status"
              + " <> 'DELETED'))",
          ap);
    }
    jdbc.update("DELETE FROM issue_labels WHERE issue_id=:id", p);
    for (var label : issue.labels())
      jdbc.update(
          "INSERT INTO issue_labels(issue_id,name,color) VALUES(:id,:name,:color)",
          Map.of("id", id, "name", label.name(), "color", label.color()));
    return id;
  }

  public void failedAdd(Context expected, long issueId, String confirmedItemId) {
    transaction.executeWithoutResult(status -> {
      if (!contexts.get(expected.teamId()).equals(expected)) throw conflict();
      int changed =
          jdbc.update(
              "UPDATE issues SET sync_status='FAILED',project_item_id=:item WHERE id=:id AND"
                  + " team_id=:team AND deleted_at IS NULL",
              Map.of("item", confirmedItemId, "id", issueId, "team", expected.teamId()));
      if (changed != 1) throw conflict();
    });
  }

  private static ApiException conflict() {
    return new ApiException(409, "STATE_CONFLICT", "팀 연결 정보가 바뀌었어요. 다시 확인해 주세요");
  }
}
