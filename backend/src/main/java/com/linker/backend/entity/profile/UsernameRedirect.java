package com.linker.backend.entity.profile;

import java.time.Instant;

import com.linker.backend.entity.account.User;
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
@Table(name = "username_redirects")
public class UsernameRedirect extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 39)
	private String oldUsername;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false)
	private Instant expiresAt;

	protected UsernameRedirect() {
	}

	public static UsernameRedirect keep(User user, String oldUsername, Instant expiresAt) {
		UsernameRedirect redirect = new UsernameRedirect();
		redirect.user = user;
		redirect.oldUsername = oldUsername;
		redirect.expiresAt = expiresAt;
		return redirect;
	}

	public void retarget(User user, Instant expiresAt) {
		this.user = user;
		this.expiresAt = expiresAt;
	}

	public User getUser() {
		return user;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}
}
