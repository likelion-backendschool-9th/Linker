package com.linker.backend.entity.github;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** Maps the existing ERD table promoted by V20; internal and GitHub identifiers remain distinct. */
@Entity
@Table(name = "github_installations")
public class GithubInstallation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private long githubInstallationId;

	@Column(nullable = false)
	private long accountId;

	@Column(nullable = false)
	private String accountLogin;

	@Column(nullable = false, length = 32)
	private String accountType;

	@Column(nullable = false, length = 16)
	private String repositorySelection;

	@Column(nullable = false)
	private Long installedBy;

	private Instant suspendedAt;

	private Instant removedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected GithubInstallation() {
	}

	public Long getId() {
		return id;
	}

	public long getGithubInstallationId() {
		return githubInstallationId;
	}

	public long getAccountId() {
		return accountId;
	}

	public String getAccountLogin() {
		return accountLogin;
	}

	public String getAccountType() {
		return accountType;
	}

	public String getRepositorySelection() {
		return repositorySelection;
	}

	public Long getInstalledBy() {
		return installedBy;
	}

	public Instant getSuspendedAt() {
		return suspendedAt;
	}

	public Instant getRemovedAt() {
		return removedAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
