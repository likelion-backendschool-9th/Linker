package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.chat.AiChatSummary;
import com.linker.backend.entity.chat.type.AiSummaryStatus;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiChatSummaryRepository extends JpaRepository<AiChatSummary, Long> {

	@Query("""
			select s from AiChatSummary s
			where s.id = :id and s.roomId = :roomId and s.requesterId = :requesterId
			""")
	Optional<AiChatSummary> findOwn(
			@Param("id") long id,
			@Param("roomId") long roomId,
			@Param("requesterId") long requesterId
	);

	/** Share takes this lock so a double tap posts one card. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select s from AiChatSummary s
			where s.id = :id and s.roomId = :roomId and s.requesterId = :requesterId
			""")
	Optional<AiChatSummary> lockOwn(
			@Param("id") long id,
			@Param("roomId") long roomId,
			@Param("requesterId") long requesterId
	);

	/**
	 * The requester's latest summary in a room that still needs a decision: not shared and not expired.
	 * A newer summary replaces it, so only the latest one counts.
	 */
	Optional<AiChatSummary> findFirstByRoomIdAndRequesterIdOrderByIdDesc(long roomId, long requesterId);

	/** Jobs ahead in the single worker's line: every PENDING row created before this one, in any room. */
	long countByStatusAndIdLessThan(AiSummaryStatus status, long id);

	List<AiChatSummary> findByStatusAndCreatedAtBefore(AiSummaryStatus status, Instant cutoff);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("delete from AiChatSummary s where s.expiresAt < :now")
	int deleteExpired(@Param("now") Instant now);
}
