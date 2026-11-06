package com.linker.backend.entity.moderation;

import java.time.Instant;

import com.linker.backend.entity.account.User;
import com.linker.backend.entity.moderation.type.AppealStatus;

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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "appeals")
public class Appeal {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "sanction_id", nullable = false)
	private Sanction sanction;

	@Column(nullable = false)
	private String body;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private AppealStatus status;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "reviewer_admin_id")
	private Admin reviewer;

	private Instant decidedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected Appeal() {
	}

	public static Appeal open(User user, Sanction sanction, String body) {
		Appeal appeal = new Appeal();
		appeal.user = user;
		appeal.sanction = sanction;
		appeal.body = body;
		appeal.status = AppealStatus.PENDING;
		return appeal;
	}

	public void accept(Admin reviewer, Instant when) {
		this.status = AppealStatus.ACCEPTED;
		this.reviewer = reviewer;
		this.decidedAt = when;
	}

	public void reject(Admin reviewer, Instant when) {
		this.status = AppealStatus.REJECTED;
		this.reviewer = reviewer;
		this.decidedAt = when;
	}

	public Long getId() {
		return id;
	}

	public User getUser() {
		return user;
	}

	public Sanction getSanction() {
		return sanction;
	}

	public String getBody() {
		return body;
	}

	public AppealStatus getStatus() {
		return status;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
