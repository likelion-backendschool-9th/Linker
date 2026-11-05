package com.linker.backend.entity.moderation;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "banned_github_ids")
public class BannedGithubId extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 255)
	private String githubUserId;

	private Long sanctionId;

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

	public String getGithubUserId() {
		return githubUserId;
	}
}
