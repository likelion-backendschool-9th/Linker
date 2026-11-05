package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatMessage;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

	@Query("""
			select m from ChatMessage m
			join fetch m.room
			where m.senderId = :senderId and m.clientMessageId = :clientMessageId
			""")
	Optional<ChatMessage> findBySenderIdAndClientMessageId(
			@Param("senderId") long senderId,
			@Param("clientMessageId") String clientMessageId
	);

	@Modifying(flushAutomatically = true)
	@Query(value = "update chat_messages set created_at = :createdAt where id = :id", nativeQuery = true)
	void assignCreatedAt(@Param("id") long id, @Param("createdAt") Instant createdAt);
}
