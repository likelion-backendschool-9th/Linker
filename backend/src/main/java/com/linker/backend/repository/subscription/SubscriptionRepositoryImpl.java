package com.linker.backend.repository.subscription;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.linker.backend.entity.subscription.type.SubscriptionStatus;

import jakarta.persistence.EntityManager;

class SubscriptionRepositoryImpl implements SubscriptionRepositoryCustom {

	private final EntityManager entityManager;

	SubscriptionRepositoryImpl(EntityManager entityManager) {
		this.entityManager = entityManager;
	}

	@Override
	public void lockTarget(String key) {
		// pg_advisory_xact_lock is PostgreSQL-only: the row may not exist yet, so FOR UPDATE cannot
		// serialize the first insert for this user/team. Released when the transaction ends.
		entityManager.createNativeQuery("select 1 from pg_advisory_xact_lock(hashtextextended(:key,0))")
				.setParameter("key", "linker:subscription:" + key)
				.getSingleResult();
	}

	@Override
	public List<FlexTeam> flexTeams(long userId, Long teamId) {
		List<Object[]> teams = entityManager.createQuery("""
				select t.id, t.name from Team t
				where t.status in ('ACTIVE', 'COMPLETED')
				  and (:teamId is null or t.id = :teamId)
				  and (exists (select 1 from TeamMember m where m.teamId = t.id and m.userId = :userId
				               and m.leftAt is null and m.role = 'OWNER')
				       or exists (select 1 from Subscription s, TeamMember p
				                  where s.teamId = t.id and s.payerUserId = :userId and s.status in :live
				                    and p.teamId = t.id and p.userId = :userId and p.leftAt is null))
				order by t.id
				""", Object[].class)
				.setParameter("userId", userId)
				.setParameter("teamId", teamId)
				.setParameter("live", SubscriptionStatus.LIVE)
				.getResultList();
		if (teams.isEmpty()) {
			return List.of();
		}
		List<Long> ids = teams.stream().map(row -> (Long) row[0]).toList();
		Map<Long, Long> counts = new HashMap<>();
		entityManager.createQuery("""
				select m.teamId, count(m) from TeamMember m
				where m.teamId in :ids and m.leftAt is null
				group by m.teamId
				""", Object[].class)
				.setParameter("ids", ids)
				.getResultList()
				.forEach(row -> counts.put((Long) row[0], (Long) row[1]));
		return teams.stream()
				.map(row -> new FlexTeam((Long) row[0], (String) row[1], counts.getOrDefault((Long) row[0], 0L)))
				.toList();
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public com.linker.backend.dto.subscription.response.SubscriptionSchemaView benefitSchema(String schema) {
		// PostgreSQL catalog inspection keeps the existing missing-table/column fallback. Data reads
		// below use JPQL; one metadata round trip replaces the old per-column service queries.
		Object[] row = (Object[]) entityManager.createNativeQuery("""
				select to_regclass(:tableName) is not null,
				  (select count(*) = 4 from information_schema.columns
				   where table_schema=coalesce(cast(:schemaName as text),current_schema()::text)
				     and table_name='subscriptions'
				     and column_name in ('user_id','plan','status','current_period_end')),
				  exists(select 1 from information_schema.columns
				   where table_schema=coalesce(cast(:schemaName as text),current_schema()::text)
				     and table_name='subscriptions' and column_name='grace_until')
				""").setParameter("tableName", schema == null ? "subscriptions" : schema + ".subscriptions")
				.setParameter("schemaName", schema).getSingleResult();
		return new com.linker.backend.dto.subscription.response.SubscriptionSchemaView(
				Boolean.TRUE.equals(row[0]) && Boolean.TRUE.equals(row[1]), Boolean.TRUE.equals(row[2]));
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public boolean subscriptionTableExists() {
		// PostgreSQL metadata; C's readiness contract checks only existence, unlike Pro's columns.
		return Boolean.TRUE.equals(entityManager.createNativeQuery("select to_regclass('subscriptions') is not null", Boolean.class).getSingleResult());
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public boolean hasProBenefit(long userId, java.time.Instant now, boolean graceAvailable) {
		String grace = graceAvailable ? " or (s.status='PAST_DUE' and s.graceUntil>:now)" : "";
		return entityManager.createQuery("select count(s)>0 from Subscription s where s.userId=:id and s.plan='PRO'"
				+ " and ((s.status in ('TRIALING','ACTIVE','PAST_DUE') and s.currentPeriodEnd>:now)" + grace + ")", Boolean.class)
				.setParameter("id", userId).setParameter("now", now).getSingleResult();
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public boolean hasFlexBenefit(long teamId, java.time.Instant now) {
		return entityManager.createQuery("""
				select count(s)>0 from Subscription s where s.teamId=:id and s.plan='FLEX'
				  and ((s.status in ('TRIALING','ACTIVE') and s.currentPeriodEnd>:now)
				    or (s.status='PAST_DUE' and s.graceUntil>:now))
				""", Boolean.class).setParameter("id", teamId).setParameter("now", now).getSingleResult();
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public boolean hasFlexChatHistoryBenefit(long teamId, java.time.Instant graceCutoff) {
		return entityManager.createQuery("""
				select count(s)>0 from Subscription s where s.teamId=:id and s.plan='FLEX'
				  and s.currentPeriodEnd>:graceCutoff
				""", Boolean.class)
				.setParameter("id", teamId)
				.setParameter("graceCutoff", graceCutoff)
				.getSingleResult();
	}

	@Override
	@org.springframework.transaction.annotation.Transactional(readOnly = true)
	public boolean hasScoutBenefit(long userId, java.time.Instant now, boolean graceAvailable) {
		String grace = graceAvailable ? " or s.graceUntil>:now" : "";
		return entityManager.createQuery("select count(s)>0 from Subscription s where s.userId=:id and s.plan='SCOUT'"
				+ " and s.status in ('ACTIVE','PAST_DUE') and (s.currentPeriodEnd>:now" + grace + ")", Boolean.class)
				.setParameter("id", userId).setParameter("now", now).getSingleResult();
	}
}
