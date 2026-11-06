package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.moderation.type.AdminRole;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "admins")
public class Admin {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AdminRole adminRole;

	private String otpSecretEnc;

	private Instant otpEnrolledAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Admin() {
	}

	public static Admin assign(User user, AdminRole adminRole) {
		Admin admin = new Admin();
		admin.user = user;
		admin.adminRole = adminRole;
		return admin;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public AdminRole getAdminRole() {
		return adminRole;
	}

	public String getOtpSecretEnc() {
		return otpSecretEnc;
	}

	public Instant getOtpEnrolledAt() {
		return otpEnrolledAt;
	}

	/** Stores an already encrypted TOTP secret. HTTP enrollment is a later step. */
	public void enrollOtp(String secretEnc, Instant when) {
		this.otpSecretEnc = secretEnc;
		this.otpEnrolledAt = when;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
