package com.linker.backend.domain.moderation;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inserts the pending case in its own transaction so a concurrent insert on the
 * partial unique index does not abort the caller's report transaction.
 */
@Service
public class ReportCaseOpener {

	private final EntityManager entityManager;

	public ReportCaseOpener(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public long openPending(ReportTargetType targetType, long targetId, long targetUserId) {
		entityManager.createNativeQuery("""
				INSERT INTO report_cases (
				    target_type, target_id, target_user_id, reporter_count, status, created_at, updated_at
				) VALUES (?1, ?2, ?3, 0, 'PENDING', now(), now())
				ON CONFLICT (target_type, target_id) WHERE status = 'PENDING' DO NOTHING
				""")
				.setParameter(1, targetType.name())
				.setParameter(2, targetId)
				.setParameter(3, targetUserId)
				.executeUpdate();
		Number id = (Number) entityManager.createNativeQuery("""
				SELECT id FROM report_cases
				WHERE target_type = ?1 AND target_id = ?2 AND status = 'PENDING'
				""")
				.setParameter(1, targetType.name())
				.setParameter(2, targetId)
				.getSingleResult();
		return id.longValue();
	}
}
