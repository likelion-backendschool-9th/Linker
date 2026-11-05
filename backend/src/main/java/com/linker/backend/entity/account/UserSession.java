package com.linker.backend.entity.account;

import java.time.Duration;
import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_sessions")
public class UserSession extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, unique = true, length = 64)
	private String refreshTokenHash;

	@Column(length = 512)
	private String userAgent;

	@Column(length = 64)
	private String ip;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant otpVerifiedAt;

	/** Last authenticated request from an operator. Idle past {@code ADMIN_OTP_IDLE_MINUTES} revokes the session. */
	private Instant operatorSeenAt;

	private Instant revokedAt;

	protected UserSession() {
	}

	public static UserSession issue(User user, String refreshTokenHash, String userAgent, String ip, Instant expiresAt) {
		UserSession session = new UserSession();
		session.user = user;
		session.refreshTokenHash = refreshTokenHash;
		session.userAgent = userAgent;
		session.ip = ip;
		session.expiresAt = expiresAt;
		return session;
	}

	public void extendTo(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public void rotate(String refreshTokenHash, Instant expiresAt) {
		this.refreshTokenHash = refreshTokenHash;
		this.expiresAt = expiresAt;
	}

	public void markOtpVerified(Instant when) {
		this.otpVerifiedAt = when;
	}

	public void revoke(Instant when) {
		this.revokedAt = when;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public Instant getOtpVerifiedAt() {
		return otpVerifiedAt;
	}

	/**
	 * @return true when the operator has been idle longer than {@code idle} and the session is now revoked
	 */
	public boolean expireOperatorIfIdle(Instant now, Duration idle) {
		if (operatorSeenAt != null && !operatorSeenAt.plus(idle).isAfter(now)) {
			revoke(now);
			return true;
		}
		this.operatorSeenAt = now;
		return false;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}
}
