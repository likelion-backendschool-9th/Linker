package com.linker.backend.entity.chat;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** One {@code @person} of a team chat message, or the single {@code @all} row (no user id). */
@Entity
@Table(name = "chat_message_mentions")
public class ChatMessageMention {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "message_id", nullable = false)
	private ChatMessage message;

	private Long mentionedUserId;

	@Column(nullable = false)
	private boolean mentionAll;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected ChatMessageMention() {
	}

	public static ChatMessageMention person(ChatMessage message, long userId) {
		ChatMessageMention mention = new ChatMessageMention();
		mention.message = message;
		mention.mentionedUserId = userId;
		return mention;
	}

	public static ChatMessageMention everyone(ChatMessage message) {
		ChatMessageMention mention = new ChatMessageMention();
		mention.message = message;
		mention.mentionAll = true;
		return mention;
	}

	public Long getId() {
		return id;
	}

	public ChatMessage getMessage() {
		return message;
	}

	public Long getMentionedUserId() {
		return mentionedUserId;
	}

	public boolean isMentionAll() {
		return mentionAll;
	}
}
