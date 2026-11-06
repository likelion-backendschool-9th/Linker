package com.linker.backend.repository.moderation;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.moderation.UserBlock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBlockRepository extends JpaRepository<UserBlock, Long> {

	Optional<UserBlock> findByBlockerIdAndBlockedIdAndUnblockedAtIsNull(long blockerId, long blockedId);

	boolean existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(long blockerId, long blockedId);

	@Query("""
			select b from UserBlock b
			where b.blockerId = :blockerId and b.unblockedAt is null
			order by b.createdAt desc
			""")
	List<UserBlock> findActive(@Param("blockerId") long blockerId);

	/**
	 * Half-open period {@code [created_at, unblocked_at)} owned by {@code blockerId}.
	 * Open periods ({@code unblocked_at IS NULL}) cover every instant at or after {@code created_at}.
	 */
	@Query("""
			select case when count(b) > 0 then true else false end from UserBlock b
			where b.blockerId = :blockerId
			  and b.blockedId = :blockedId
			  and b.createdAt <= :at
			  and (b.unblockedAt is null or b.unblockedAt > :at)
			""")
	boolean existsCovering(
			@Param("blockerId") long blockerId,
			@Param("blockedId") long blockedId,
			@Param("at") Instant at
	);

	@Query("""
			select b.blockedId from UserBlock b
			where b.blockerId = :userId and b.unblockedAt is null
			""")
	List<Long> findActiveBlockedIds(@Param("userId") long userId);

	@Query("""
			select b.blockerId from UserBlock b
			where b.blockedId = :userId and b.unblockedAt is null
			""")
	List<Long> findActiveBlockerIds(@Param("userId") long userId);
}
