package com.linker.backend.repository.moderation;

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
}
