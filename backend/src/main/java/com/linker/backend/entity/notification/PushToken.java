package com.linker.backend.entity.notification;

import java.time.Instant;

import com.linker.backend.entity.account.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "push_tokens")
public class PushToken {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "expo_push_token", nullable = false, length = 512)
	private String expoPushToken;

	@Column(nullable = false, length = 16)
	private String platform;

	@Column(length = 64)
	private String appVersion;

	@Column(nullable = false)
	private Instant lastUsedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected PushToken() {
	}

	public static PushToken register(User user, String token, Instant when) {
		PushToken row = new PushToken();
		row.user = user;
		row.expoPushToken = token;
		row.platform = "ANDROID";
		row.lastUsedAt = when;
		return row;
	}

	public void reassign(User user, Instant when) {
		this.user = user;
		this.lastUsedAt = when;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public String getExpoPushToken() {
		return expoPushToken;
	}

	public String getPlatform() {
		return platform;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
