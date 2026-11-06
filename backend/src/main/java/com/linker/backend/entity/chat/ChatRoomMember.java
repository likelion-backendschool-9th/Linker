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

@Entity
@Table(name = "chat_room_members")
public class ChatRoomMember {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "room_id", nullable = false)
	private ChatRoom room;

	@Column(nullable = false)
	private Long userId;

	private Long lastReadMessageId;

	@Column(nullable = false)
	private boolean muted;

	@Column(nullable = false)
	private Instant joinedAt;

	private Instant leftAt;

	private Instant hiddenAt;

	@CreationTimestamp
	@Column(nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(nullable = false)
	private Instant updatedAt;

	protected ChatRoomMember() {
	}

	public static ChatRoomMember join(ChatRoom room, long userId) {
		ChatRoomMember member = new ChatRoomMember();
		member.room = room;
		member.userId = userId;
		member.muted = false;
		member.joinedAt = Instant.now();
		return member;
	}

	public void readUntil(Long messageId) {
		this.lastReadMessageId = messageId;
	}

	public void mute(boolean muted) {
		this.muted = muted;
	}

	public void leave(Instant when) {
		this.leftAt = when;
	}

	public void hide(Instant when) {
		this.hiddenAt = when;
	}

	public ChatRoom getRoom() {
		return room;
	}

	public Long getUserId() {
		return userId;
	}

	public boolean isMuted() {
		return muted;
	}

	public Long getLastReadMessageId() {
		return lastReadMessageId;
	}

	public Instant getHiddenAt() {
		return hiddenAt;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
