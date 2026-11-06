package com.linker.backend.repository.chat;

import com.linker.backend.entity.chat.ChatMessageMention;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageMentionRepository extends JpaRepository<ChatMessageMention, Long> {

	long countByMessageId(Long messageId);
}
