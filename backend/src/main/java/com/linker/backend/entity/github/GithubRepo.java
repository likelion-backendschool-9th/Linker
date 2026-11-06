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

@Entity
@Table(name = "github_repos")
public class GithubRepo {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true)
	private long githubRepoId;

	@Column(nullable = false, length = 255)
	private String ownerLogin;

	@Column(nullable = false, length = 255)
	private String name;

	@Column(nullable = false, unique = true, length = 513)
	private String fullName;

	@Column(length = 1000)
	private String description;

	@Column(length = 64)
	private String primaryLanguage;

	@Column(nullable = false)
	private int stargazersCount;

	@Column(nullable = false)
	private int forksCount;

	@Column(length = 2048)
	private String htmlUrl;

	@Column(nullable = false)
	private boolean isPrivate;

	@Column(nullable = false)
	private boolean isFork;

	@Column(length = 513)
	private String parentFullName;

	@Column(length = 255)
	private String defaultBranch;

	private Instant metadataSyncedAt;

	private Instant deletedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected GithubRepo() {
	}

	public Long getId() {
		return id;
	}

	public String getOwnerLogin() {
		return ownerLogin;
	}

	public String getFullName() {
		return fullName;
	}

	public String getDescription() {
		return description;
	}

	public String getPrimaryLanguage() {
		return primaryLanguage;
	}

	public int getStargazersCount() {
		return stargazersCount;
	}

	public int getForksCount() {
		return forksCount;
	}

	public boolean isPrivate() {
		return isPrivate;
	}

	public boolean isFork() {
		return isFork;
	}

	public String getParentFullName() {
		return parentFullName;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public boolean isSelectable() {
		return deletedAt == null && !isPrivate;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
