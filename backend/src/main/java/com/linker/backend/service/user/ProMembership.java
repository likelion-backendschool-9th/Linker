package com.linker.backend.service.user;

import java.time.Instant;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads Pro state before {@code subscriptions} has an entity.
 * A missing table means nobody is Pro.
 */
@Component
class ProMembership {

	private final EntityManager entityManager;

	ProMembership(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Transactional(readOnly = true)
	boolean active(long userId, Instant now) {
		if (!tableExists() || !columnExists("user_id") || !columnExists("plan")
				|| !columnExists("status") || !columnExists("current_period_end")) {
			return false;
		}
		boolean grace = columnExists("grace_until");
		// Native until D's subscriptions table gets its migration and Entity (no JPQL target yet).
		String sql = grace
				? """
				select exists (
				  select 1 from subscriptions
				  where user_id = :userId
				    and plan = 'PRO'
				    and (
				      (status in ('TRIALING', 'ACTIVE', 'PAST_DUE') and current_period_end > :now)
				      or (status = 'PAST_DUE' and grace_until is not null and grace_until > :now)
				    )
				)
				"""
				: """
				select exists (
				  select 1 from subscriptions
				  where user_id = :userId
				    and plan = 'PRO'
				    and status in ('TRIALING', 'ACTIVE', 'PAST_DUE')
				    and current_period_end > :now
				)
				""";
		return Boolean.TRUE.equals(entityManager.createNativeQuery(sql, Boolean.class)
				.setParameter("userId", userId)
				.setParameter("now", now)
				.getSingleResult());
	}

	private boolean tableExists() {
		return Boolean.TRUE.equals(entityManager
				.createNativeQuery("select to_regclass('subscriptions') is not null", Boolean.class)
				.getSingleResult());
	}

	private boolean columnExists(String column) {
		Number count = (Number) entityManager.createNativeQuery("""
				select count(*) from information_schema.columns
				where table_schema = current_schema()
				  and table_name = 'subscriptions'
				  and column_name = :column
				""")
				.setParameter("column", column)
				.getSingleResult();
		return count != null && count.intValue() > 0;
	}
}
