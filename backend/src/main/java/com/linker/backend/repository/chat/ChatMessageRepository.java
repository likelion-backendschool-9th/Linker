package com.linker.backend.repository.chat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.linker.backend.entity.chat.ChatMessage;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long>, ChatMessageRepositoryCustom {

	/** Caller holds the team and room locks: system sender IDs are intentionally NULL. */
	@Query("""
			select count(m)>0 from ChatMessage m where m.room.id=:roomId
			  and m.messageType='PR_EVENT' and m.clientMessageId=:deliveryKey
			""")
	boolean containsPullRequestDelivery(long roomId, String deliveryKey);

	@Query("select m.room.id from ChatMessage m where m.id = :id")
	Optional<Long> findRoomId(@Param("id") long id);

	@Query("""
			select m from ChatMessage m
			join fetch m.room
			where m.senderId = :senderId and m.clientMessageId = :clientMessageId
			""")
	Optional<ChatMessage> findBySenderIdAndClientMessageId(
			@Param("senderId") long senderId,
			@Param("clientMessageId") String clientMessageId
	);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select m from ChatMessage m where m.id = :id")
	Optional<ChatMessage> lockById(@Param("id") long id);

	@Query("select m from ChatMessage m join fetch m.room where m.id = :id")
	Optional<ChatMessage> findWithRoom(@Param("id") long id);

	@Modifying(flushAutomatically = true)
	@Query(value = "update chat_messages set created_at = :createdAt where id = :id", nativeQuery = true)
	void assignCreatedAt(@Param("id") long id, @Param("createdAt") Instant createdAt);

	/**
	 * Newest-first TEXT/PR_EVENT lines for AI summary: visible, not deleted, not from people the
	 * viewer currently blocks.
	 */
	@Query("""
			select m from ChatMessage m
			where m.room.id = :roomId
			  and m.deletedAt is null
			  and m.visibility = com.linker.backend.entity.chat.type.MessageVisibility.VISIBLE
			  and m.messageType in (
			    com.linker.backend.entity.chat.type.MessageType.TEXT,
			    com.linker.backend.entity.chat.type.MessageType.PR_EVENT
			  )
			  and (m.senderId is null or not exists (
			    select 1 from UserBlock b
			    where b.blockerId = :viewerId and b.blockedId = m.senderId and b.unblockedAt is null
			  ))
			order by m.id desc
			""")
	List<ChatMessage> findForAiSummary(
			@Param("roomId") long roomId,
			@Param("viewerId") long viewerId,
			Pageable pageable
	);
}
