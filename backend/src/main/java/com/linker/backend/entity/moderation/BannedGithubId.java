package com.linker.backend.entity.moderation;

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
@Table(name = "banned_github_ids")
public class BannedGithubId {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 255)
	private String githubUserId;

	private Long sanctionId;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected BannedGithubId() {
	}

	public static BannedGithubId ban(String githubUserId) {
		BannedGithubId banned = new BannedGithubId();
		banned.githubUserId = githubUserId;
		return banned;
	}

	public Long getId() {
		return id;
	}

	public static BannedGithubId ban(String githubUserId, long sanctionId) {
		BannedGithubId row = ban(githubUserId);
		row.sanctionId = sanctionId;
		return row;
	}

	public Long getSanctionId() { return sanctionId; }

	public String getGithubUserId() {
		return githubUserId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
