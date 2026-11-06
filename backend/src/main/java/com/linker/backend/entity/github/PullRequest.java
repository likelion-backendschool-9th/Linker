package com.linker.backend.entity.github;

import java.time.Instant;

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
import com.linker.backend.entity.github.type.PullRequestState;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "pull_requests")
public class PullRequest {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long teamId;

	@Column(nullable = false)
	private Long repoId;

	@Column(nullable = false, unique = true)
	private long githubPrId;

	@Column(nullable = false)
	private int number;

	@Column(nullable = false, columnDefinition = "text")
	private String title;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private PullRequestState state;

	@Column(nullable = false)
	private boolean draft;

	private String authorLogin;

	@Column(length = 2048)
	private String htmlUrl;

	private Instant mergedAt;

	private Instant closedAt;

	@Column(nullable = false)
	private Instant githubUpdatedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected PullRequest() {
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

	public long getGithubPrId() {
		return githubPrId;
	}

	public int getNumber() {
		return number;
	}

	public String getTitle() {
		return title;
	}

	public PullRequestState getState() {
		return state;
	}

	public boolean isDraft() {
		return draft;
	}

	public String getAuthorLogin() {
		return authorLogin;
	}

	public String getHtmlUrl() {
		return htmlUrl;
	}

	public Instant getMergedAt() {
		return mergedAt;
	}

	public Instant getClosedAt() {
		return closedAt;
	}

	public Instant getGithubUpdatedAt() {
		return githubUpdatedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
