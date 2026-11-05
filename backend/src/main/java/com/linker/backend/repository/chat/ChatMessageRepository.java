package com.linker.backend.repository.chat;

import com.linker.backend.entity.chat.ChatMessage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
}
