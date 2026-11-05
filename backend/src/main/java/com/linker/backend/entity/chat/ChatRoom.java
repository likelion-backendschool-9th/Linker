package com.linker.backend.entity.chat;

import java.time.Instant;

import com.linker.backend.global.jpa.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "chat_rooms")
public class ChatRoom extends BaseTimeEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 16)
	private RoomType roomType;

	private Long teamId;

	@Column(length = 64)
	private String dmKey;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private DmStatus dmStatus;

	@Enumerated(EnumType.STRING)
	@Column(length = 16)
	private RequestKind requestKind;

	private Long requesterId;

	private Instant requestExpiresAt;

	private Instant respondedAt;

	private Long lastMessageId;

	private Instant lastMessageAt;

	protected ChatRoom() {
	}

	public static ChatRoom direct(
			long requesterId,
			long otherUserId,
			DmStatus status,
			RequestKind kind,
			Instant requestExpiresAt
	) {
		ChatRoom room = new ChatRoom();
		room.roomType = RoomType.DIRECT;
		long low = Math.min(requesterId, otherUserId);
		long high = Math.max(requesterId, otherUserId);
		room.dmKey = low + ":" + high;
		room.dmStatus = status;
		room.requestKind = kind;
		room.requesterId = requesterId;
		room.requestExpiresAt = requestExpiresAt;
		return room;
	}

	public static ChatRoom team(Long teamId) {
		ChatRoom room = new ChatRoom();
		room.roomType = RoomType.TEAM;
		room.teamId = teamId;
		return room;
	}

	public void markAccepted(Instant when) {
		this.dmStatus = DmStatus.ACCEPTED;
		this.respondedAt = when;
	}

	public void markRejected(Instant when) {
		this.dmStatus = DmStatus.REJECTED;
		this.respondedAt = when;
	}

	public boolean admitsSubscriber() {
		if (roomType == RoomType.TEAM) {
			return true;
		}
		return dmStatus == DmStatus.ACCEPTED || dmStatus == DmStatus.REQUESTED;
	}

	public boolean admitsSender() {
		if (roomType == RoomType.TEAM) {
			return true;
		}
		return dmStatus == DmStatus.ACCEPTED;
	}

	public Long getId() {
		return id;
	}

	public RoomType getRoomType() {
		return roomType;
	}

	public DmStatus getDmStatus() {
		return dmStatus;
	}

	public Long getRequesterId() {
		return requesterId;
	}

	public Instant getRequestExpiresAt() {
		return requestExpiresAt;
	}

	public Instant getRespondedAt() {
		return respondedAt;
	}

	public Long getLastMessageId() {
		return lastMessageId;
	}

	public void markLastMessage(long messageId, Instant at) {
		this.lastMessageId = messageId;
		this.lastMessageAt = at;
	}
}
