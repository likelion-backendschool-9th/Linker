package com.linker.backend.entity.account;

import java.time.Instant;

import com.linker.backend.entity.account.type.VerificationPurpose;

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

@Entity
@Table(name = "email_verifications")
public class EmailVerification {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 320)
	private String email;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private VerificationPurpose purpose;

	private Long userId;

	@Column(nullable = false, length = 64)
	private String codeHash;

	@Column(nullable = false)
	private int attemptCount;

	@Column(nullable = false)
	private Instant expiresAt;

	private Instant usedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected EmailVerification() {
	}

	public static EmailVerification issue(String email, VerificationPurpose purpose, Long userId, String codeHash, Instant expiresAt) {
		EmailVerification row = new EmailVerification();
		row.email = email;
		row.purpose = purpose;
		row.userId = userId;
		row.codeHash = codeHash;
		row.expiresAt = expiresAt;
		return row;
	}

	public void replaceSecret(String codeHash, Instant expiresAt) {
		this.codeHash = codeHash;
		this.expiresAt = expiresAt;
		this.attemptCount = 0;
	}

	public void recordFailure() {
		this.attemptCount++;
	}

	public void use(Instant when) {
		this.usedAt = when;
	}

	public boolean expired(Instant now) {
		return expiresAt.isBefore(now);
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public Long getUserId() {
		return userId;
	}

	public String getCodeHash() {
		return codeHash;
	}

	public int getAttemptCount() {
		return attemptCount;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
