package com.linker.backend.repository.chat;

import java.util.Optional;

import com.linker.backend.entity.chat.AiChatSummary;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
