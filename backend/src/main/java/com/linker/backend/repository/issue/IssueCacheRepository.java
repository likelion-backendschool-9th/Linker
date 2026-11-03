package com.linker.backend.repository.issue;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import com.linker.backend.dto.issue.CachedIssue;
import com.linker.backend.dto.issue.IssueCacheSnapshot;
import com.linker.backend.dto.issue.ProjectsRefreshContext.BoardStatus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC projection over the existing ERD, like the repository layer's native insert helpers.
 * No startup SQL. Activate callers only after B's prerequisites and the reviewed issue migration exist.
 */
@Repository
public class IssueCacheRepository {

	private final JdbcTemplate jdbc;

	public IssueCacheRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

	/** Insert conflicts may target either unique key. Lock the existing row before refreshing relations. */
	public WriteResult upsert(IssueCacheSnapshot snapshot, Instant now) {
		List<Long> updated = jdbc.query("""
				INSERT INTO issues (team_id, repo_id, github_issue_id, github_node_id, number,
				 title, state, board_status, author_user_id, author_login, created_via_linker,
				 sync_status, sub_issues_total, sub_issues_done, html_url, github_updated_at, closed_at,
				 synced_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'NONE', ?, ?, false, 'PENDING', 0, 0, ?, ?, ?, ?, ?, ?)
				ON CONFLICT DO NOTHING
				RETURNING id
				""", (rs, row) -> rs.getLong(1), snapshot.teamId(), snapshot.repoId(), snapshot.githubIssueId(),
				snapshot.githubNodeId(), snapshot.number(), snapshot.title(), snapshot.state().name(),
				snapshot.authorUserId(), snapshot.authorLogin(), snapshot.htmlUrl(), Timestamp.from(snapshot.githubUpdatedAt()),
				timestamp(snapshot.closedAt()), Timestamp.from(now), Timestamp.from(now), Timestamp.from(now));
		if (!updated.isEmpty()) return new WriteResult(updated.getFirst(), true);
		List<Identity> existing = jdbc.query("""
				SELECT id, team_id, repo_id, github_node_id, number, github_updated_at
				FROM issues WHERE github_issue_id = ? FOR UPDATE
				""", (rs, row) -> new Identity(rs.getLong("id"), rs.getLong("team_id"), rs.getLong("repo_id"),
				rs.getString("github_node_id"), rs.getInt("number"), rs.getTimestamp("github_updated_at").toInstant()), snapshot.githubIssueId());
		if (existing.isEmpty()) throw new IllegalArgumentException("Issue number already belongs to another GitHub identity");
		Identity identity = existing.getFirst();
		if (identity.teamId() != snapshot.teamId() || identity.repoId() != snapshot.repoId()
				|| !identity.nodeId().equals(snapshot.githubNodeId()) || identity.number() != snapshot.number()) {
			throw new IllegalArgumentException("Issue cache context mismatch; verified transfer is required");
		}
		if (!snapshot.githubUpdatedAt().isAfter(identity.version())) return new WriteResult(identity.id(), false);
		jdbc.update("""
				UPDATE issues SET title = ?, state = ?, author_user_id = ?, author_login = ?, html_url = ?,
				 github_updated_at = ?, closed_at = ?, synced_at = ?, updated_at = ? WHERE id = ?
				""", snapshot.title(), snapshot.state().name(), snapshot.authorUserId(), snapshot.authorLogin(), snapshot.htmlUrl(),
				Timestamp.from(snapshot.githubUpdatedAt()), timestamp(snapshot.closedAt()), Timestamp.from(now), Timestamp.from(now), identity.id());
		return new WriteResult(identity.id(), true);
	}

	public void replaceRelations(long id, IssueCacheSnapshot snapshot, Instant now) {
		jdbc.update("DELETE FROM issue_assignees WHERE issue_id = ?", id);
		jdbc.update("DELETE FROM issue_labels WHERE issue_id = ?", id);
		if (!snapshot.assignees().isEmpty()) {
			jdbc.batchUpdate("""
					INSERT INTO issue_assignees (issue_id, github_user_id, github_login, user_id, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?)
					""", snapshot.assignees(), 100, (statement, assignee) -> {
				statement.setLong(1, id); statement.setLong(2, assignee.githubUserId());
				statement.setString(3, assignee.login()); statement.setObject(4, assignee.userId());
				statement.setTimestamp(5, Timestamp.from(now)); statement.setTimestamp(6, Timestamp.from(now));
			});
		}
		if (!snapshot.labels().isEmpty()) {
			jdbc.batchUpdate("""
					INSERT INTO issue_labels (issue_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
					""", snapshot.labels(), 100, (statement, label) -> {
				statement.setLong(1, id); statement.setString(2, label.name()); statement.setString(3, label.color());
				statement.setTimestamp(4, Timestamp.from(now)); statement.setTimestamp(5, Timestamp.from(now));
			});
		}
	}

	/** Caller supplies an authorized team context. This query is not membership authorization. */
	public Optional<CachedIssue> findForTeam(long id, long teamId) {
		List<CachedIssue> rows = jdbc.query("SELECT * FROM issues WHERE id = ? AND team_id = ?",
				(rs, row) -> new CachedIssue(rs.getLong("id"), snapshot(rs)), id, teamId);
		if (rows.isEmpty()) return Optional.empty();
		List<IssueCacheSnapshot.Assignee> assignees = jdbc.query("""
				SELECT github_user_id, github_login, user_id FROM issue_assignees WHERE issue_id = ? ORDER BY github_user_id
				""", (rs, row) -> new IssueCacheSnapshot.Assignee(rs.getLong(1), rs.getString(2), rs.getObject(3, Long.class)), id);
		List<IssueCacheSnapshot.Label> labels = jdbc.query("""
				SELECT name, color FROM issue_labels WHERE issue_id = ? ORDER BY name
				""", (rs, row) -> new IssueCacheSnapshot.Label(rs.getString(1), rs.getString(2)), id);
		CachedIssue base = rows.getFirst();
		return Optional.of(new CachedIssue(base.id(), base.snapshot().withRelations(assignees, labels)));
	}

	public ProjectReference lockProjectReference(long id, long teamId, long repoId) {
		List<ProjectReference> rows = jdbc.query("SELECT id, state FROM issues WHERE id = ? AND team_id = ? AND repo_id = ? FOR UPDATE",
				(rs, row) -> new ProjectReference(rs.getLong("id"), IssueCacheSnapshot.State.valueOf(rs.getString("state"))), id, teamId, repoId);
		if (rows.size() != 1) throw new IllegalArgumentException("Cached issue is outside verified Projects context");
		return rows.getFirst();
	}

	public void applyProjectValues(long id, String itemId, BoardStatus status, LocalDate start, LocalDate due, Instant now) {
		jdbc.update("""
				UPDATE issues SET project_item_id = ?, board_status = ?, start_date = ?, due_date = ?,
				 sync_status = CASE WHEN sync_status = 'FAILED' OR EXISTS (
				   SELECT 1 FROM issue_sync_jobs WHERE issue_id = issues.id AND status IN ('PENDING','RUNNING','FAILED')
				 ) THEN sync_status ELSE 'SYNCED' END,
				 synced_at = ?, updated_at = ? WHERE id = ?
				""", itemId, status.name(), start, due, Timestamp.from(now), Timestamp.from(now), id);
	}

	public record ProjectReference(long id, IssueCacheSnapshot.State state) { }

	private static IssueCacheSnapshot snapshot(ResultSet rs) throws SQLException {
		return new IssueCacheSnapshot(rs.getLong("team_id"), rs.getLong("repo_id"), rs.getLong("github_issue_id"),
				rs.getString("github_node_id"), rs.getInt("number"), rs.getString("title"),
				IssueCacheSnapshot.State.valueOf(rs.getString("state")), rs.getObject("author_user_id", Long.class),
				rs.getString("author_login"), rs.getString("html_url"), rs.getTimestamp("github_updated_at").toInstant(),
				rs.getTimestamp("closed_at") == null ? null : rs.getTimestamp("closed_at").toInstant(), List.of(), List.of());
	}

	private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
	private record Identity(long id, long teamId, long repoId, String nodeId, int number, Instant version) { }
	public record WriteResult(long issueId, boolean updated) { }
}
