package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.account.User;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "admins")
public class Admin extends BaseTimeEntity {

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
}
