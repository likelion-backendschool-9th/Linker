package com.linker.backend.repository.chat;

import java.util.Optional;

import com.linker.backend.entity.chat.ChatRoomMember;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

	@Query("""
			select m from ChatRoomMember m
			join fetch m.room r
			where r.id = :roomId and m.userId = :userId and m.leftAt is null
			""")
	Optional<ChatRoomMember> findActive(@Param("roomId") long roomId, @Param("userId") long userId);
}
