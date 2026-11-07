package com.linker.backend.repository.subscription;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long>, SubscriptionRepositoryCustom {

	/** The live (TRIALING / ACTIVE / PAST_DUE) PRO or SCOUT row; the partial unique index allows one. */
	Optional<Subscription> findFirstByUserIdAndStatusIn(long userId, Collection<SubscriptionStatus> statuses);

	List<Subscription> findByTeamIdInAndStatusIn(Collection<Long> teamIds, Collection<SubscriptionStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.userId = :userId and s.status in :statuses")
	Optional<Subscription> lockLiveForUser(long userId, Collection<SubscriptionStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.teamId = :teamId and s.status in :statuses")
	Optional<Subscription> lockLiveForTeam(long teamId, Collection<SubscriptionStatus> statuses);
}
