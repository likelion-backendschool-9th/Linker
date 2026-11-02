package com.linker.backend.domain.moderation;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_blocks")
public class UserBlock extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long blockerId;

	@Column(nullable = false)
	private Long blockedId;

	private Instant unblockedAt;

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
}
