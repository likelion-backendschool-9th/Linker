package com.linker.backend.domain.moderation;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BlockInserter {

	private final EntityManager entityManager;

	public BlockInserter(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void insertActive(long blockerId, long blockedId) {
		entityManager.createNativeQuery("""
				INSERT INTO user_blocks (blocker_id, blocked_id, created_at, updated_at)
				VALUES (?1, ?2, now(), now())
				ON CONFLICT (blocker_id, blocked_id) WHERE unblocked_at IS NULL DO NOTHING
				""")
				.setParameter(1, blockerId)
				.setParameter(2, blockedId)
				.executeUpdate();
	}
}
