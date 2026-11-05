package com.linker.backend.global.jpa;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

	@CreatedDate
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	@Column(nullable = false)
	private Instant updatedAt;

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	/**
	 * Aligns the in-memory instant with a value already written to the database.
	 * Auditing still fills {@code created_at} on insert. {@code updatable = false} keeps later flushes from reverting a native correction.
	 */
	protected final void replaceCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}
}
