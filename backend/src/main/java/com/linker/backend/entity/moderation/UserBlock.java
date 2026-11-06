package com.linker.backend.entity.moderation;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "user_blocks")
public class UserBlock {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long blockerId;

	@Column(nullable = false)
	private Long blockedId;

	private Instant unblockedAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected UserBlock() {
	}

	public void close(Instant when) {
		this.unblockedAt = when;
	}

	public Long getId() {
		return id;
	}

	public Long getBlockerId() {
		return blockerId;
	}

	public Long getBlockedId() {
		return blockedId;
	}

	public Instant getUnblockedAt() {
		return unblockedAt;
	}

	public Instant getCreatedAtValue() {
		return getCreatedAt();
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
