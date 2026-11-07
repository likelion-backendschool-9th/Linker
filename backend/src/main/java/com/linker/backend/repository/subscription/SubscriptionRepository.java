package com.linker.backend.repository.subscription;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.subscription.Subscription;
import com.linker.backend.entity.subscription.type.SubscriptionStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long>, SubscriptionRepositoryCustom {

  /** Batch form of the existing hasFlexBenefit predicate; no Pro/Scout policy is substituted. */
  @Query(
      """
      select s.teamId from Subscription s where s.plan='FLEX' and s.teamId in :teamIds
        and ((s.status in ('ACTIVE','TRIALING') and s.currentPeriodEnd>:now)
          or (s.status='PAST_DUE' and s.graceUntil>:now))
      """)
  List<Long> findTeamsWithFlexBenefit(Collection<Long> teamIds, Instant now);

	@Query("select s from Subscription s where s.userId=:userId or s.payerUserId=:userId order by s.id desc")
	List<Subscription> findAdministrationHistory(long userId, Pageable page);

	/** The live (TRIALING / ACTIVE / PAST_DUE) PRO or SCOUT row; the partial unique index allows one. */
	Optional<Subscription> findFirstByUserIdAndStatusIn(long userId, Collection<SubscriptionStatus> statuses);

	List<Subscription> findByTeamIdInAndStatusIn(Collection<Long> teamIds, Collection<SubscriptionStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.userId = :userId and s.status in :statuses")
	Optional<Subscription> lockLiveForUser(long userId, Collection<SubscriptionStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.teamId = :teamId and s.status in :statuses")
	Optional<Subscription> lockLiveForTeam(long teamId, Collection<SubscriptionStatus> statuses);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select s from Subscription s where s.id = :id")
	Optional<Subscription> lockById(long id);

	/** Running rows the caller sees on page 29: own Pro/Scout and the Flex teams the caller pays for. */
	@Query("""
			select s from Subscription s
			where (s.userId = :userId or (s.teamId is not null and s.payerUserId = :userId))
			  and s.status in :statuses and s.currentPeriodEnd > :now
			order by s.id
			""")
	List<Subscription> findCurrentFor(long userId, Collection<SubscriptionStatus> statuses, Instant now);

	/** Live rows whose paid period has ended, oldest end first, for the expiry job. */
	@Query("""
			select s.id from Subscription s
			where s.status in :statuses and s.currentPeriodEnd <= :now
			order by s.currentPeriodEnd, s.id
			""")
	List<Long> findLapsedIds(Collection<SubscriptionStatus> statuses, Instant now, Pageable page);
}
