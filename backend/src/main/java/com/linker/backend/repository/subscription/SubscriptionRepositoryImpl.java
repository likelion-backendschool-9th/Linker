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
}
