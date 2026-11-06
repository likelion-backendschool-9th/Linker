package com.linker.backend.entity.chat;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "chat_messages")
public class ChatMessage extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "room_id", nullable = false)
	private ChatRoom room;

	private Long senderId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private MessageType messageType;

	@Column(columnDefinition = "text")
	private String body;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private MessageVisibility visibility;

	private Instant deletedAt;

	@Column(name = "client_message_id", length = 36)
	private String clientMessageId;

	private Instant editedAt;

	protected ChatMessage() {
	}

	public static ChatMessage text(ChatRoom room, Long senderId, String body) {
		return create(room, senderId, MessageType.TEXT, body, MessageVisibility.VISIBLE);
	}

	public static ChatMessage clientText(ChatRoom room, long senderId, String body, String clientMessageId) {
		ChatMessage message = text(room, senderId, body);
		message.clientMessageId = clientMessageId;
		return message;
	}

	public static ChatMessage clientImage(ChatRoom room, long senderId, String clientMessageId) {
		ChatMessage message = create(room, senderId, MessageType.IMAGE, "", MessageVisibility.VISIBLE);
		message.clientMessageId = clientMessageId;
		return message;
	}

	public static ChatMessage system(ChatRoom room, String body) {
		return create(room, null, MessageType.SYSTEM, body, MessageVisibility.VISIBLE);
	}

	public static ChatMessage create(
			ChatRoom room,
			Long senderId,
			MessageType messageType,
			String body,
			MessageVisibility visibility
	) {
		ChatMessage message = new ChatMessage();
		message.room = room;
		message.senderId = senderId;
		message.messageType = messageType;
		message.body = body;
		message.visibility = visibility;
		return message;
	}

	public void revise(String body, Instant editedAt) {
		this.body = body;
		this.editedAt = editedAt;
	}

	public void delete(Instant when) {
		this.deletedAt = when;
	}

	public void hide() {
		this.visibility = MessageVisibility.HIDDEN;
	}

	public Long getId() {
		return id;
	}

	public ChatRoom getRoom() {
		return room;
	}

	public Long getSenderId() {
		return senderId;
	}

	public String getBody() {
		return body;
	}

	public MessageType getMessageType() {
		return messageType;
	}

	public String getClientMessageId() {
		return clientMessageId;
	}

	public Instant getEditedAt() {
		return editedAt;
	}

	public Instant getDeletedAt() {
		return deletedAt;
	}

	public MessageVisibility getVisibility() {
		return visibility;
	}

	public void alignCreatedAt(Instant createdAt) {
		replaceCreatedAt(createdAt);
	}
}
