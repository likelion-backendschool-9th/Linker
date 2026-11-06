package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatRoom;
import com.linker.backend.entity.chat.type.RequestKind;
import com.linker.backend.entity.chat.type.RoomType;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long>, ChatRoomRepositoryCustom {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select r from ChatRoom r where r.id = :id")
	Optional<ChatRoom> lockById(@Param("id") long id);

	long countByRequesterIdAndRoomTypeAndRequestKindAndCreatedAtGreaterThanEqual(
			Long requesterId, RoomType roomType, RequestKind requestKind, Instant createdAt
	);

	/** Recruiting offers the recruiter opened since {@code start}. */
	default int countRecruitingOffersSince(long recruiterId, Instant start) {
		return (int) countByRequesterIdAndRoomTypeAndRequestKindAndCreatedAtGreaterThanEqual(
				recruiterId, RoomType.DIRECT, RequestKind.RECRUITING, start);
	}
}
