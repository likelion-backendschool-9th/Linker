package com.linker.backend.repository.moderation;

import java.sql.Timestamp;
import java.time.Instant;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class BlockInserter {

	private final EntityManager entityManager;

	public BlockInserter(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	/**
	 * {@code createdAt} is the application clock truncated to microseconds.
	 * PostgreSQL {@code now()} is not used: it can lead the JVM clock that stamps chat messages.
	 */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void insertActive(long blockerId, long blockedId, Instant createdAt) {
		Timestamp stored = Timestamp.from(createdAt);
		entityManager.createNativeQuery("""
				INSERT INTO user_blocks (blocker_id, blocked_id, created_at, updated_at)
				VALUES (?1, ?2, ?3, ?3)
				ON CONFLICT (blocker_id, blocked_id) WHERE unblocked_at IS NULL DO NOTHING
				""")
				.setParameter(1, blockerId)
				.setParameter(2, blockedId)
				.setParameter(3, stored)
				.executeUpdate();
	}
}
