package com.linker.backend.entity.account;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "auth_identities")
public class AuthIdentity extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AuthProvider provider;

	@Column(nullable = false, length = 255)
	private String providerUserId;

	@Column(length = 255)
	private String providerLogin;

	@Column(length = 320)
	private String email;

	@Column(length = 255)
	private String passwordHash;

	@Column(nullable = false)
	private int failedLoginCount;

	private Instant lockedUntil;

	private Instant lastLoginAt;

	protected AuthIdentity() {
	}

	public static AuthIdentity github(User user, String githubUserId, String login, String email, Instant when) {
		AuthIdentity identity = new AuthIdentity();
		identity.user = user;
		identity.provider = AuthProvider.GITHUB;
		identity.providerUserId = githubUserId;
		identity.providerLogin = login;
		identity.email = email;
		identity.lastLoginAt = when;
		return identity;
	}

	public static AuthIdentity email(User user, String email, String passwordHash, Instant when) {
		AuthIdentity identity = new AuthIdentity();
		identity.user = user;
		identity.provider = AuthProvider.EMAIL;
		identity.providerUserId = email;
		identity.email = email;
		identity.passwordHash = passwordHash;
		identity.lastLoginAt = when;
		return identity;
	}

	public void recordLogin(String login, String email, Instant when) {
		this.providerLogin = login;
		if (email != null && !email.isBlank()) {
			this.email = email;
		}
		clearFailures(when);
	}

	public void recordSuccess(Instant when) {
		clearFailures(when);
	}

	public void changePassword(String passwordHash) {
		this.passwordHash = passwordHash;
		this.failedLoginCount = 0;
		this.lockedUntil = null;
	}

	public void recordFailure(Instant lockedUntil) {
		this.failedLoginCount++;
		this.lockedUntil = lockedUntil;
	}

	public void clearExpiredLock() {
		this.failedLoginCount = 0;
		this.lockedUntil = null;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public int getFailedLoginCount() {
		return failedLoginCount;
	}

	public Instant getLockedUntil() {
		return lockedUntil;
	}

	private void clearFailures(Instant when) {
		this.failedLoginCount = 0;
		this.lockedUntil = null;
		this.lastLoginAt = when;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}
}
