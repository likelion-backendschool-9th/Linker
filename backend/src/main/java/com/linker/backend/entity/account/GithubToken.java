package com.linker.backend.entity.account;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "github_tokens")
public class GithubToken {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Column(nullable = false)
	private String accessTokenEnc;

	private Instant accessExpiresAt;

	private String refreshTokenEnc;

	private Instant refreshExpiresAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected GithubToken() {
	}

	public static GithubToken issue(User user, String accessTokenEnc, Instant accessExpiresAt, String refreshTokenEnc, Instant refreshExpiresAt) {
		GithubToken token = new GithubToken();
		token.user = user;
		token.replace(accessTokenEnc, accessExpiresAt, refreshTokenEnc, refreshExpiresAt);
		return token;
	}

	public void replace(String accessTokenEnc, Instant accessExpiresAt, String refreshTokenEnc, Instant refreshExpiresAt) {
		this.accessTokenEnc = accessTokenEnc;
		this.accessExpiresAt = accessExpiresAt;
		this.refreshTokenEnc = refreshTokenEnc;
		this.refreshExpiresAt = refreshExpiresAt;
	}

	public Long getId() {
		return id;
	}

	public String getAccessTokenEnc() {
		return accessTokenEnc;
	}

	public Instant getAccessExpiresAt() {
		return accessExpiresAt;
	}

	public String getRefreshTokenEnc() {
		return refreshTokenEnc;
	}

	public Instant getRefreshExpiresAt() {
		return refreshExpiresAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
