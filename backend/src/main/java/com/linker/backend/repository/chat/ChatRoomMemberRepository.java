package com.linker.backend.repository.chat;

import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatRoomMember;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

	@Query("""
			select m from ChatRoomMember m
			join fetch m.room r
			where r.id = :roomId and m.userId = :userId and m.leftAt is null
			""")
	Optional<ChatRoomMember> findActive(@Param("roomId") long roomId, @Param("userId") long userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			select m from ChatRoomMember m
			where m.room.id = :roomId and m.userId = :userId and m.leftAt is null
			""")
	Optional<ChatRoomMember> lockActive(@Param("roomId") long roomId, @Param("userId") long userId);

	@Query("""
			select m.userId from ChatRoomMember m
			where m.room.id = :roomId and m.leftAt is null
			""")
	List<Long> findActiveUserIds(@Param("roomId") long roomId);

	@Query("""
			select m from ChatRoomMember m
			where m.room.id = :roomId and m.leftAt is null
			order by m.userId
			""")
	List<ChatRoomMember> findActiveInRoom(@Param("roomId") long roomId);

	/** Includes a row that left; the pair is unique per room and user. */
	@Query("""
			select m from ChatRoomMember m
			where m.room.id = :roomId and m.userId = :userId
			""")
	Optional<ChatRoomMember> findAnyInRoom(@Param("roomId") long roomId, @Param("userId") long userId);
}
