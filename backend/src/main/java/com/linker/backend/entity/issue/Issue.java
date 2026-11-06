package com.linker.backend.entity.issue;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import com.linker.backend.entity.issue.type.IssueState;
import com.linker.backend.entity.issue.type.IssueSyncStatus;
import com.linker.backend.entity.team.type.BoardStatus;

/**
 * Linker's DB copy of a GitHub issue (V22). GitHub is authoritative: rows change only through
 * source reads under the team issue lock. Team/repo/user references stay plain IDs (B's style).
 */
@Entity
@Table(name = "issues")
public class Issue {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long teamId;

	@Column(nullable = false)
	private Long repoId;

	@Column(nullable = false, unique = true)
	private Long githubIssueId;

	@Column(nullable = false)
	private String githubNodeId;

	@Column(nullable = false)
	private int number;

	@Column(nullable = false, columnDefinition = "text")
	private String title;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private IssueState state;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private BoardStatus boardStatus;

	private String projectItemId;

	private LocalDate startDate;

	private LocalDate dueDate;

	private Long authorUserId;

	private String authorLogin;

	@Column(nullable = false)
	private boolean createdViaLinker;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private IssueSyncStatus syncStatus = IssueSyncStatus.SYNCED;

	private Long parentIssueId;

	@Column(nullable = false)
	private int subIssuesTotal;

	@Column(nullable = false)
	private int subIssuesDone;

	@Column(columnDefinition = "text")
	private String htmlUrl;

	@Column(nullable = false)
	private Instant githubUpdatedAt;

	private Instant closedAt;

	private Instant deletedAt;

	private Instant syncedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Issue() {
	}

	/** First source read of a GitHub issue. */
	public static Issue fromSource(long teamId, long githubIssueId) {
		Issue issue = new Issue();
		issue.teamId = teamId;
		issue.githubIssueId = githubIssueId;
		return issue;
	}

	/** Newer (or first) source read: GitHub values win and a soft-deleted row comes back. */
	public void applySource(
			long repoId,
			String nodeId,
			int number,
			String title,
			IssueState state,
			BoardStatus board,
			String itemId,
			LocalDate start,
			LocalDate due,
			String authorLogin,
			String url,
			Instant githubUpdatedAt,
			Instant closedAt,
			Instant now) {
		this.repoId = repoId;
		this.githubNodeId = nodeId;
		this.number = number;
		this.title = title;
		this.state = state;
		this.authorLogin = authorLogin;
		this.htmlUrl = url;
		this.githubUpdatedAt = githubUpdatedAt;
		this.closedAt = closedAt;
		this.deletedAt = null;
		applyProject(board, itemId, start, due, now);
	}

	/**
	 * Older issue payload: Projects field reads are fresh under the same lock, so only they apply.
	 * A closed issue stays DONE.
	 */
	public void applyProjectOnly(BoardStatus board, String itemId, LocalDate start, LocalDate due, Instant now) {
		applyProject(state == IssueState.CLOSED ? BoardStatus.DONE : board, itemId, start, due, now);
	}

	private void applyProject(BoardStatus board, String itemId, LocalDate start, LocalDate due, Instant now) {
		this.boardStatus = board;
		this.projectItemId = itemId;
		this.startDate = start;
		this.dueDate = due;
		this.syncStatus = IssueSyncStatus.SYNCED;
		this.syncedAt = now;
	}

	public Long getId() {
		return id;
	}

	public Long getTeamId() {
		return teamId;
	}

	public Long getRepoId() {
		return repoId;
	}

	public Long getGithubIssueId() {
		return githubIssueId;
	}

	public String getGithubNodeId() {
		return githubNodeId;
	}

	public int getNumber() {
		return number;
	}

	public String getTitle() {
		return title;
	}

	public IssueState getState() {
		return state;
	}

	public BoardStatus getBoardStatus() {
		return boardStatus;
	}

	public String getProjectItemId() {
		return projectItemId;
	}

	public LocalDate getStartDate() {
		return startDate;
	}

	public LocalDate getDueDate() {
		return dueDate;
	}

	public Long getAuthorUserId() {
		return authorUserId;
	}

	public String getAuthorLogin() {
		return authorLogin;
	}

	public boolean isCreatedViaLinker() {
		return createdViaLinker;
	}

	public IssueSyncStatus getSyncStatus() {
		return syncStatus;
	}

	public Long getParentIssueId() {
		return parentIssueId;
	}

	public int getSubIssuesTotal() {
		return subIssuesTotal;
	}

	public int getSubIssuesDone() {
		return subIssuesDone;
	}

	public String getHtmlUrl() {
		return htmlUrl;
	}

	public Instant getGithubUpdatedAt() {
		return githubUpdatedAt;
	}

	public Instant getClosedAt() {
		return closedAt;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public Instant getSyncedAt() {
		return syncedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
