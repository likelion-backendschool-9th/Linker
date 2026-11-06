package com.linker.backend.entity.issue;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** GitHub assignee as-is; userId links a Linker developer with the same GitHub identity. */
@Entity
@Table(name = "issue_assignees")
public class IssueAssignee {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long issueId;

	@Column(nullable = false)
	private Long githubUserId;

	@Column(nullable = false)
	private String githubLogin;

	private Long userId;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected IssueAssignee() {
	}

	public IssueAssignee(long issueId, long githubUserId, String githubLogin, Long userId) {
		this.issueId = issueId;
		this.githubUserId = githubUserId;
		this.githubLogin = githubLogin;
		this.userId = userId;
	}

	public Long getId() {
		return id;
	}

	public Long getIssueId() {
		return issueId;
	}

	public Long getGithubUserId() {
		return githubUserId;
	}

	public String getGithubLogin() {
		return githubLogin;
	}

	public Long getUserId() {
		return userId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
