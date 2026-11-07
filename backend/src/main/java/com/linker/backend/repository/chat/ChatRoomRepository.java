package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.chat.type.RoomType;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long>, ChatRoomRepositoryCustom {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from ChatRoom r where r.id = :id")
	Optional<ChatRoom> lockById(@Param("id") long id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from ChatRoom r where r.dmKey = :dmKey")
	Optional<ChatRoom> lockByDmKey(@Param("dmKey") String dmKey);

	@Query("select r.id from ChatRoom r where r.dmKey = :dmKey")
	Optional<Long> findIdByDmKey(@Param("dmKey") String dmKey);

	/**
	 * Native for PostgreSQL {@code ON CONFLICT}: two people opening the same pair at once must not abort
	 * the caller's transaction on the {@code dm_key} unique index. Returns 1 when this call created the row.
	 */
	@Modifying(flushAutomatically = true)
	@Query(value = """
			INSERT INTO chat_rooms (room_type, dm_key, dm_status, request_kind, requester_id, created_at, updated_at)
			VALUES ('DIRECT', :dmKey, 'ACCEPTED', 'GENERAL', :requesterId, :now, :now)
			ON CONFLICT (dm_key) WHERE dm_key IS NOT NULL DO NOTHING
			""", nativeQuery = true)
	int insertAcceptedIfAbsent(
			@Param("dmKey") String dmKey, @Param("requesterId") long requesterId, @Param("now") Instant now);

	/** Same conflict handling as {@link #insertAcceptedIfAbsent}, for a new general request. */
	@Modifying(flushAutomatically = true)
	@Query(value = """
			INSERT INTO chat_rooms (
			    room_type, dm_key, dm_status, request_kind, requester_id, request_expires_at, created_at, updated_at
			) VALUES ('DIRECT', :dmKey, 'REQUESTED', 'GENERAL', :requesterId, :expiresAt, :now, :now)
			ON CONFLICT (dm_key) WHERE dm_key IS NOT NULL DO NOTHING
			""", nativeQuery = true)
	int insertRequestIfAbsent(
			@Param("dmKey") String dmKey,
			@Param("requesterId") long requesterId,
			@Param("expiresAt") Instant expiresAt,
			@Param("now") Instant now);

	long countByRequesterIdAndRoomTypeAndRequestKindAndCreatedAtGreaterThanEqual(
			Long requesterId, RoomType roomType, RequestKind requestKind, Instant createdAt
	);

	/** Recruiting offers the recruiter opened since {@code start}. */
	default int countRecruitingOffersSince(long recruiterId, Instant start) {
		return (int) countByRequesterIdAndRoomTypeAndRequestKindAndCreatedAtGreaterThanEqual(
				recruiterId, RoomType.DIRECT, RequestKind.RECRUITING, start);
	}
}
