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

	public Long getId() {
		return id;
	}
}
